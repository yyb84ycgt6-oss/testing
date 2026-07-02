export interface StoredChunkMeta {
  chunkFile: string;
  logicalBytes: number;
  compressedBytes: number;
  checksum: string;
}

export interface StoredFileMeta {
  path: string;
  updatedAt: string;
  chunks: StoredChunkMeta[];
}

export interface VfsIndex {
  files: Record<string, StoredFileMeta>;
}

export interface DiskStats {
  logicalBytes: number;
  compressedBytes: number;
  workingSetBytes: number;
  compressionRatio: number;
  fileCount: number;
}

export type ParsedTerminalCommand =
  | { type: 'agent-review'; target: string | null }
  | { type: 'unknown'; raw: string };

export function computeDiskStats(index: VfsIndex, workingSetBytes: number): DiskStats {
  const metas = Object.values(index.files);
  const logicalBytes = metas.reduce(
    (sum, file) => sum + file.chunks.reduce((chunkSum, chunk) => chunkSum + chunk.logicalBytes, 0),
    0
  );
  const compressedBytes = metas.reduce(
    (sum, file) => sum + file.chunks.reduce((chunkSum, chunk) => chunkSum + chunk.compressedBytes, 0),
    0
  );

  return {
    logicalBytes,
    compressedBytes,
    workingSetBytes,
    compressionRatio: logicalBytes === 0 ? 1 : compressedBytes / logicalBytes,
    fileCount: metas.length
  };
}

export function buildAiPrompt(userPrompt: string, activeFilePath: string | null, activeFileContent: string): string {
  const context = activeFilePath
    ? `Current file: ${activeFilePath}\n---\n${activeFileContent.slice(0, 20_000)}\n---\n`
    : 'No current file context available.\n';
  return `${context}User request: ${userPrompt}`;
}

export function parseTerminalCommand(raw: string): ParsedTerminalCommand {
  const trimmed = raw.trim();
  const match = /^agent\s+review(?:\s+(.+))?$/i.exec(trimmed);
  if (match) {
    return { type: 'agent-review', target: match[1]?.trim() ?? null };
  }
  return { type: 'unknown', raw: trimmed };
}

export function buildAgentSynthesis(supervisorResult: string, specialistResult: string): string {
  return `Supervisor:\n${supervisorResult}\n\nSpecialist:\n${specialistResult}`;
}
