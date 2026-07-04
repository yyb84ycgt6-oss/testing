import { describe, expect, it } from 'vitest';
import { AgentOrchestrator } from '../src/agents.js';
import { evaluatePhaseGates } from '../src/gates.js';
import { PluginSecurityManager, signManifest } from '../src/plugins.js';
import { ProviderRouter, runAdapterContract, type ModelProviderAdapter } from '../src/providers.js';
import { CapabilityPermissionEngine } from '../src/security.js';

function makeAdapter(def: Partial<ModelProviderAdapter> & Pick<ModelProviderAdapter, 'id' | 'mode'>): ModelProviderAdapter {
  return {
    id: def.id,
    mode: def.mode,
    supportsModel: def.supportsModel ?? (() => true),
    healthCheck: def.healthCheck ?? (async () => ({ healthy: true, latencyMs: 5 })),
    run: def.run ?? (async (request) => ({ providerId: def.id, output: `ok:${request.prompt}` }))
  };
}

describe('provider router and contracts', () => {
  it('falls back across providers', async () => {
    const a1 = makeAdapter({
      id: 'p1',
      mode: 'local',
      run: async () => {
        throw new Error('fail');
      }
    });
    const a2 = makeAdapter({ id: 'p2', mode: 'cloud' });

    const router = new ProviderRouter([a1, a2]);
    const result = await router.route({ model: 'm', prompt: 'hello' });
    expect(result.response.providerId).toBe('p2');
    expect(result.attemptedProviders).toEqual(['p1', 'p2']);
  });

  it('validates adapter contract', async () => {
    const adapter = makeAdapter({ id: 'x', mode: 'hybrid' });
    const result = await runAdapterContract(adapter);
    expect(result.passed).toBe(true);
  });
});

describe('agent orchestrator skeleton', () => {
  it('builds delegation plan with permissions', async () => {
    const permissions = new CapabilityPermissionEngine();
    permissions.setPolicy('supervisor', {
      capabilities: ['read', 'write', 'exec'],
      doubleCheckCapabilities: ['write', 'exec']
    });

    const router = new ProviderRouter([makeAdapter({ id: 'ollama', mode: 'local', supportsModel: (m) => m === 'llama' })]);
    const orchestrator = new AgentOrchestrator(
      permissions,
      {
        supervisor: 'llama',
        context: 'tiny-context',
        code: 'tiny-code',
        safety: 'tiny-safety'
      },
      router
    );

    const plan = orchestrator.buildPlan({ prompt: 'review', requestedCapabilities: ['read', 'write'] });
    expect(plan.delegatedTo).toEqual(['context', 'code', 'safety']);
    expect(plan.decisions[1].requiresUserApproval).toBe(true);

    const output = await orchestrator.synthesize('ping');
    expect(output).toContain('ping');
  });
});

describe('plugin security and phase gates', () => {
  it('verifies signatures, enforces quotas, and supports kill switch', () => {
    const manager = new PluginSecurityManager();
    const manifest = {
      id: 'plugin-a',
      version: '1.0.0',
      permissionSchemaVersion: 1 as const,
      permissions: ['read', 'write'] as const,
      quotas: { maxMemoryMb: 10, maxCpuMsPerMinute: 100 }
    };

    const signature = signManifest(manifest, 'secret');
    expect(manager.verifyManifest(manifest, signature, 'secret')).toBe(true);

    manager.register(manifest);
    manager.consumeQuota('plugin-a', manifest, { memoryMb: 5, cpuMs: 20 });
    expect(manager.readState('plugin-a').enabled).toBe(true);

    expect(() => manager.consumeQuota('plugin-a', manifest, { memoryMb: 10, cpuMs: 1 })).toThrow(/quota/);
    manager.killSwitch('plugin-a');
    expect(manager.readState('plugin-a').enabled).toBe(false);
  });

  it('evaluates measurable phase gates', () => {
    const pass = evaluatePhaseGates(
      {
        startupLatencyMs: 400,
        ramWorkingSetMb: 80,
        compressionRatio: 0.6,
        auditCoverage: 0.95,
        integrityPassRate: 0.99
      },
      {
        startupLatencyMsMax: 500,
        ramWorkingSetMbMax: 100,
        compressionRatioMax: 0.8,
        auditCoverageMin: 0.9,
        integrityPassRateMin: 0.95
      }
    );

    expect(pass.passed).toBe(true);

    const fail = evaluatePhaseGates(
      {
        startupLatencyMs: 800,
        ramWorkingSetMb: 120,
        compressionRatio: 0.9,
        auditCoverage: 0.5,
        integrityPassRate: 0.8
      },
      {
        startupLatencyMsMax: 500,
        ramWorkingSetMbMax: 100,
        compressionRatioMax: 0.8,
        auditCoverageMin: 0.9,
        integrityPassRateMin: 0.95
      }
    );

    expect(fail.passed).toBe(false);
    expect(fail.failures).toContain('startupLatencyMs');
  });
});
