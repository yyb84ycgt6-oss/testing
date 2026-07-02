import { describe, expect, it } from 'vitest';
import {
  buildCompatibilityReport,
  getAllIntegrations,
  getIntegrationsByCategory,
  getPriorityStack
} from '../src/integrations.js';

describe('integration catalog', () => {
  it('contains requested OpenClaw and WhiteRabbit definitions', () => {
    const all = getAllIntegrations();
    expect(all.find((t) => t.id === 'openclaw')).toBeTruthy();
    expect(all.find((t) => t.id === 'whiterabbit')).toBeTruthy();
  });

  it('contains coding assistant category entries', () => {
    const coding = getIntegrationsByCategory('coding-assistant');
    expect(coding.length).toBeGreaterThan(5);
  });

  it('returns all prioritized stack entries', () => {
    const priority = getPriorityStack();
    expect(priority.map((tool) => tool.id)).toContain('openclaw');
    expect(priority).toHaveLength(15);
  });

  it('reports missing capabilities for local/cloud compatibility', () => {
    const missing = buildCompatibilityReport(['ollama', 'coderabbit', 'flowise', 'openclaw'], {
      docker: false,
      node: true,
      python: false,
      gpu: true,
      vscodeExtensionHost: false,
      localOllama: false,
      openWebUI: true,
      cloudProxy: false
    });

    expect(missing).toEqual([
      { toolId: 'ollama', missing: ['localOllama'] },
      { toolId: 'coderabbit', missing: ['cloudProxy'] },
      { toolId: 'openclaw', missing: ['python'] }
    ]);
  });
});
