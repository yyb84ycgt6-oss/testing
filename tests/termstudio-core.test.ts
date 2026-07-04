import { describe, expect, it } from 'vitest';
import {
  buildAgentSynthesis,
  buildAiPrompt,
  computeDiskStats,
  parseTerminalCommand,
  type VfsIndex
} from '../src/termstudio-core.js';

describe('termstudio core helpers', () => {
  it('computes disk stats', () => {
    const index: VfsIndex = {
      files: {
        '/a.txt': {
          path: '/a.txt',
          updatedAt: new Date().toISOString(),
          chunks: [
            { chunkFile: 'c1', logicalBytes: 100, compressedBytes: 50, checksum: 'x' },
            { chunkFile: 'c2', logicalBytes: 100, compressedBytes: 60, checksum: 'y' }
          ]
        }
      }
    };

    const stats = computeDiskStats(index, 30);
    expect(stats.logicalBytes).toBe(200);
    expect(stats.compressedBytes).toBe(110);
    expect(stats.workingSetBytes).toBe(30);
    expect(stats.fileCount).toBe(1);
  });

  it('attaches active file context to prompt', () => {
    const prompt = buildAiPrompt('Summarize', '/notes.md', 'file-content');
    expect(prompt).toContain('Current file: /notes.md');
    expect(prompt).toContain('file-content');
  });

  it('parses agent review terminal command', () => {
    expect(parseTerminalCommand('agent review')).toEqual({ type: 'agent-review', target: null });
    expect(parseTerminalCommand('agent review src/main.ts')).toEqual({ type: 'agent-review', target: 'src/main.ts' });
    expect(parseTerminalCommand('ls')).toEqual({ type: 'unknown', raw: 'ls' });
  });

  it('builds supervisor + specialist synthesis', () => {
    const synthesis = buildAgentSynthesis('sup', 'spec');
    expect(synthesis).toContain('Supervisor');
    expect(synthesis).toContain('Specialist');
  });
});
