import { describe, expect, it } from 'vitest';
import { CapabilityPermissionEngine, SignedAuditLogChain } from '../src/security.js';

describe('capability permissions', () => {
  it('enforces capability and double-check policies', () => {
    const engine = new CapabilityPermissionEngine();
    engine.setPolicy('supervisor', {
      capabilities: ['read', 'write'],
      doubleCheckCapabilities: ['write']
    });

    const allowed = engine.evaluate({ agentId: 'supervisor', capability: 'read', resource: 'repo' });
    expect(allowed.approved).toBe(true);
    expect(allowed.requiresUserApproval).toBe(false);

    const write = engine.evaluate({ agentId: 'supervisor', capability: 'write', resource: 'repo' });
    expect(write.approved).toBe(true);
    expect(write.requiresUserApproval).toBe(true);

    const denied = engine.evaluate({ agentId: 'supervisor', capability: 'network', resource: 'repo' });
    expect(denied.approved).toBe(false);
  });
});

describe('signed audit log chain', () => {
  it('detects tampering', () => {
    const chain = new SignedAuditLogChain(Buffer.from('a'.repeat(32)));
    chain.append({ actor: 'a1', action: 'read', summary: 'ok', approved: true });
    chain.append({ actor: 'a2', action: 'write', summary: 'ok', approved: false });

    expect(chain.verifyChain().valid).toBe(true);

    const entries = chain.list();
    entries[1].summary = 'tampered';
    // simulate external tamper by casting private field access through JSON replay
    const tampered = new SignedAuditLogChain(Buffer.from('a'.repeat(32)));
    for (const entry of entries) {
      (tampered as unknown as { entries: typeof entries }).entries = entries;
    }

    expect(tampered.verifyChain().valid).toBe(false);
  });
});
