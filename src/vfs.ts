import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { createHash, randomUUID } from 'node:crypto';

export interface VfsConfig {
  chunkSize: number;
  compressionLevel: number;
  maxWorkingSetBytes: number;
}

export interface VfsMetrics {
  logicalSizeBytes: number;
  compressedSizeBytes: number;
  workingSetBytes: number;
  cacheHits: number;
  cacheMisses: number;
  compressionRatio: number;
  quarantinedChunks: number;
}

interface ChunkRecord {
  id: string;
  checksum: string;
  logicalSize: number;
  compressed: Buffer;
}

interface FileRecord {
  path: string;
  chunks: string[];
  createdAt: string;
  updatedAt: string;
}

interface SnapshotRecord {
  id: string;
  path: string;
  chunks: string[];
  createdAt: string;
}

function checksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

class LruCache {
  private readonly map = new Map<string, Buffer>();
  private currentSize = 0;

  constructor(private readonly maxBytes: number) {}

  get(key: string): Buffer | null {
    const value = this.map.get(key);
    if (!value) return null;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: Buffer): void {
    const existing = this.map.get(key);
    if (existing) {
      this.currentSize -= existing.byteLength;
      this.map.delete(key);
    }

    this.map.set(key, value);
    this.currentSize += value.byteLength;

    while (this.currentSize > this.maxBytes && this.map.size > 0) {
      const oldestKey = this.map.keys().next().value as string;
      const oldest = this.map.get(oldestKey);
      if (oldest) this.currentSize -= oldest.byteLength;
      this.map.delete(oldestKey);
    }
  }

  clear(): void {
    this.map.clear();
    this.currentSize = 0;
  }

  sizeBytes(): number {
    return this.currentSize;
  }
}

export class CompressedVFS {
  private readonly config: VfsConfig;
  private readonly chunks = new Map<string, ChunkRecord>();
  private readonly files = new Map<string, FileRecord>();
  private readonly snapshots = new Map<string, SnapshotRecord[]>();
  private readonly quarantine = new Set<string>();
  private readonly cache: LruCache;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config?: Partial<VfsConfig>) {
    this.config = {
      chunkSize: config?.chunkSize ?? 64 * 1024,
      compressionLevel: config?.compressionLevel ?? 4,
      maxWorkingSetBytes: config?.maxWorkingSetBytes ?? 100 * 1024 * 1024
    };
    this.cache = new LruCache(this.config.maxWorkingSetBytes);
  }

  writeFile(path: string, content: Buffer | string): { snapshotId: string | null } {
    const buffer = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content, 'utf8');
    const existing = this.files.get(path);
    let snapshotId: string | null = null;

    if (existing) {
      snapshotId = this.createSnapshot(path, existing.chunks);
    }

    const chunks: string[] = [];
    for (let offset = 0; offset < buffer.byteLength; offset += this.config.chunkSize) {
      const slice = buffer.subarray(offset, Math.min(buffer.byteLength, offset + this.config.chunkSize));
      const id = randomUUID();
      const compressed = brotliCompressSync(slice, {
        params: { 1: this.config.compressionLevel }
      });
      this.chunks.set(id, {
        id,
        checksum: checksum(slice),
        logicalSize: slice.byteLength,
        compressed
      });
      chunks.push(id);
    }

    const now = new Date().toISOString();
    this.files.set(path, {
      path,
      chunks,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });

    return { snapshotId };
  }

  readFile(path: string): Buffer {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);

    const parts: Buffer[] = [];
    for (const chunkId of file.chunks) {
      if (this.quarantine.has(chunkId)) {
        throw new Error(`Chunk quarantined: ${chunkId}`);
      }

      const cached = this.cache.get(chunkId);
      if (cached) {
        this.cacheHits += 1;
        parts.push(Buffer.from(cached));
        continue;
      }

      this.cacheMisses += 1;
      const chunk = this.chunks.get(chunkId);
      if (!chunk) throw new Error(`Missing chunk ${chunkId}`);
      const decompressed = brotliDecompressSync(chunk.compressed);
      if (checksum(decompressed) !== chunk.checksum) {
        this.quarantine.add(chunkId);
        throw new Error(`Checksum mismatch for chunk ${chunkId}`);
      }
      this.cache.set(chunkId, decompressed);
      parts.push(decompressed);
    }

    return Buffer.concat(parts);
  }

  deleteFile(path: string): { snapshotId: string | null } {
    const existing = this.files.get(path);
    if (!existing) return { snapshotId: null };

    const snapshotId = this.createSnapshot(path, existing.chunks);
    this.files.delete(path);
    this.cache.clear();
    return { snapshotId };
  }

  listFiles(): string[] {
    return [...this.files.keys()].sort();
  }

  getMetrics(): VfsMetrics {
    const logicalSizeBytes = [...this.chunks.values()].reduce((sum, chunk) => sum + chunk.logicalSize, 0);
    const compressedSizeBytes = [...this.chunks.values()].reduce((sum, chunk) => sum + chunk.compressed.byteLength, 0);
    return {
      logicalSizeBytes,
      compressedSizeBytes,
      workingSetBytes: this.cache.sizeBytes(),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      compressionRatio: logicalSizeBytes === 0 ? 1 : compressedSizeBytes / logicalSizeBytes,
      quarantinedChunks: this.quarantine.size
    };
  }

  evictWorkingSet(): void {
    this.cache.clear();
  }

  integrityScan(): { ok: boolean; corruptedPaths: string[] } {
    const corrupted = new Set<string>();
    for (const [path, file] of this.files.entries()) {
      for (const chunkId of file.chunks) {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) {
          corrupted.add(path);
          continue;
        }
        try {
          const decompressed = brotliDecompressSync(chunk.compressed);
          if (checksum(decompressed) !== chunk.checksum) {
            this.quarantine.add(chunkId);
            corrupted.add(path);
          }
        } catch {
          this.quarantine.add(chunkId);
          corrupted.add(path);
        }
      }
    }

    return { ok: corrupted.size === 0, corruptedPaths: [...corrupted].sort() };
  }

  rollback(path: string, snapshotId: string): void {
    const records = this.snapshots.get(path) ?? [];
    const snapshot = records.find((record) => record.id === snapshotId);
    if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);

    const existing = this.files.get(path);
    const now = new Date().toISOString();
    this.files.set(path, {
      path,
      chunks: [...snapshot.chunks],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
  }

  attemptRepair(path: string): { repaired: boolean; snapshotUsed: string | null } {
    const records = [...(this.snapshots.get(path) ?? [])].reverse();
    for (const snapshot of records) {
      let valid = true;
      for (const chunkId of snapshot.chunks) {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) {
          valid = false;
          break;
        }
        try {
          const decompressed = brotliDecompressSync(chunk.compressed);
          if (checksum(decompressed) !== chunk.checksum) {
            valid = false;
            break;
          }
        } catch {
          valid = false;
          break;
        }
      }

      if (valid) {
        this.rollback(path, snapshot.id);
        return { repaired: true, snapshotUsed: snapshot.id };
      }
    }

    return { repaired: false, snapshotUsed: null };
  }

  mutateChunkForTest(chunkId: string, mutator: (buffer: Buffer) => Buffer): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) throw new Error(`Missing chunk: ${chunkId}`);
    const mutated = mutator(Buffer.from(chunk.compressed));
    this.chunks.set(chunkId, { ...chunk, compressed: mutated });
    this.cache.clear();
  }

  getFileChunkIds(path: string): string[] {
    const file = this.files.get(path);
    if (!file) throw new Error(`File not found: ${path}`);
    return [...file.chunks];
  }

  private createSnapshot(path: string, chunks: string[]): string {
    const id = randomUUID();
    const existing = this.snapshots.get(path) ?? [];
    existing.push({ id, path, chunks: [...chunks], createdAt: new Date().toISOString() });
    this.snapshots.set(path, existing);
    return id;
  }
}

export class DiskManager {
  constructor(private readonly vfs: CompressedVFS) {}

  getStats(): VfsMetrics {
    return this.vfs.getMetrics();
  }

  evictWorkingSet(): void {
    this.vfs.evictWorkingSet();
  }

  integrityScan(): { ok: boolean; corruptedPaths: string[] } {
    return this.vfs.integrityScan();
  }
}
