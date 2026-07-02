import { describe, expect, it, vi } from 'vitest';
import { createTermStudioTool } from '../src/termstudio-tool.js';

describe('termstudio drop-in tool', () => {
  it('merges default and custom config', () => {
    const tool = createTermStudioTool(
      {
        runModel: async () => 'ok'
      },
      { supervisorModel: 'grok-max', agentMode: true }
    );

    const cfg = tool.getConfig();
    expect(cfg.supervisorModel).toBe('grok-max');
    expect(cfg.specialistModel).toBe('qwen2.5:3b');
    expect(cfg.agentMode).toBe(true);
  });

  it('runs supervisor and specialist in agent mode', async () => {
    const runModel = vi
      .fn()
      .mockResolvedValueOnce('supervisor-result')
      .mockResolvedValueOnce('specialist-result');
    const tool = createTermStudioTool({ runModel }, { agentMode: true, supervisorModel: 'grok' });
    tool.setActiveFile('/tmp/a.ts', 'const x = 1;');

    const result = await tool.ask('review');
    expect(runModel).toHaveBeenCalledTimes(2);
    expect(result.usedModels).toEqual(['grok', 'qwen2.5:3b']);
    expect(result.response).toContain('Supervisor:');
    expect(result.response).toContain('Specialist:');
  });

  it('supports command confirmation for agent review', async () => {
    const runModel = vi.fn().mockResolvedValue('approved-review');
    const confirm = vi.fn().mockResolvedValue(false);
    const tool = createTermStudioTool({ runModel, confirm }, { agentMode: false });
    tool.setActiveFile('/src/app.ts', 'hello');

    const result = await tool.runCommand('agent review');
    expect(confirm).toHaveBeenCalledOnce();
    expect(runModel).not.toHaveBeenCalled();
    expect(result).toBe('[agent] Review cancelled by user.');
  });

  it('handles unknown terminal commands', async () => {
    const tool = createTermStudioTool({ runModel: async () => 'unused' });
    const result = await tool.runCommand('pwd');
    expect(result).toBe('[terminal] Unknown command: pwd');
  });
});
