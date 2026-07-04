import { describe, expect, it } from 'vitest';
import { CompressedVFS, DiskManager } from '../src/vfs.js';

describe('compressed VFS', () => {
  it('writes, reads, and reports metrics', () => {
    const vfs = new CompressedVFS({ chunkSize: 8, maxWorkingSetBytes: 1024 });
    vfs.writeFile('/a.txt', 'hello world hello world');
    const read = vfs.readFile('/a.txt').toString('utf8');
    expect(read).toBe('hello world hello world');

    const metrics = vfs.getMetrics();
    expect(metrics.logicalSizeBytes).toBeGreaterThan(0);
    expect(metrics.compressedSizeBytes).toBeGreaterThan(0);
  });

  it('supports snapshot rollback and repair after corruption', () => {
    const vfs = new CompressedVFS({ chunkSize: 5 });
    vfs.writeFile('/doc.txt', 'first');
    const { snapshotId } = vfs.writeFile('/doc.txt', 'second version');
    expect(snapshotId).toBeTruthy();

    const chunkId = vfs.getFileChunkIds('/doc.txt')[0];
    vfs.mutateChunkForTest(chunkId, (buf) => {
      const copy = Buffer.from(buf);
      copy[0] = copy[0] ^ 255;
      return copy;
    });

    expect(() => vfs.readFile('/doc.txt')).toThrow();

    const repair = vfs.attemptRepair('/doc.txt');
    expect(repair.repaired).toBe(true);
    expect(vfs.readFile('/doc.txt').toString('utf8')).toBe('first');
  });

  it('exposes disk manager controls', () => {
    const vfs = new CompressedVFS();
    const manager = new DiskManager(vfs);
    vfs.writeFile('/x.txt', 'x'.repeat(128));
    vfs.readFile('/x.txt');
    expect(manager.getStats().workingSetBytes).toBeGreaterThan(0);
    manager.evictWorkingSet();
    expect(manager.getStats().workingSetBytes).toBe(0);
    expect(manager.integrityScan().ok).toBe(true);
  });
});
