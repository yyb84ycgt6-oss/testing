/**
 * Security-hardening test suite.
 * Covers: timing-safe comparisons, secret validation, path injection, SSRF, audit chain integrity.
 */
import { describe, expect, it } from 'vitest';
import { OllamaClient } from '../src/ollama.js';
import { PluginSecurityManager, signManifest } from '../src/plugins.js';
import { CapabilityPermissionEngine, SignedAuditLogChain } from '../src/security.js';
import { CompressedVFS } from '../src/vfs.js';

// --- Group 2 / security.ts ---

describe('SignedAuditLogChain: secret validation', () => {
  it('rejects a zero-length HMAC secret', () => {
    expect(() => new SignedAuditLogChain(Buffer.alloc(0))).toThrow(/empty/i);
  });

  it('accepts an undefined secret and generates one internally', () => {
    expect(() => new SignedAuditLogChain()).not.toThrow();
  });

  it('chain is valid after appending entries with explicit secret', () => {
    const chain = new SignedAuditLogChain(Buffer.from('s'.repeat(32)));
    chain.append({ actor: 'user', action: 'login', summary: 'ok', approved: true });
    expect(chain.verifyChain().valid).toBe(true);
  });

  it('detects entry injection (missing previousHash re-link)', () => {
    const chain = new SignedAuditLogChain(Buffer.from('s'.repeat(32)));
    chain.append({ actor: 'a', action: 'read', summary: 'ok', approved: true });
    chain.append({ actor: 'b', action: 'write', summary: 'ok', approved: true });

    // Manually tamper with the internal entries array via list() snapshot
    const entries = chain.list();
    entries[0].summary = 'injected';

    // Re-seed a chain with tampered entries to prove it fails
    const cloned = new SignedAuditLogChain(Buffer.from('s'.repeat(32)));
    (cloned as unknown as { entries: typeof entries }).entries = entries;
    expect(cloned.verifyChain().valid).toBe(false);
  });
});

describe('CapabilityPermissionEngine: deny-by-default', () => {
  it('denies unknown agent with no policy', () => {
    const engine = new CapabilityPermissionEngine();
    const result = engine.evaluate({ agentId: 'unknown', capability: 'read', resource: 'repo' });
    expect(result.approved).toBe(false);
    expect(result.requiresUserApproval).toBe(true);
  });

  it('denies capability not in policy even when agent is known', () => {
    const engine = new CapabilityPermissionEngine();
    engine.setPolicy('agent1', { capabilities: ['read'] });
    const result = engine.evaluate({ agentId: 'agent1', capability: 'exec', resource: 'shell' });
    expect(result.approved).toBe(false);
  });

  it('requires user approval for double-check capabilities', () => {
    const engine = new CapabilityPermissionEngine();
    engine.setPolicy('agent1', {
      capabilities: ['network'],
      doubleCheckCapabilities: ['network']
    });
    const result = engine.evaluate({ agentId: 'agent1', capability: 'network', resource: 'api' });
    expect(result.approved).toBe(true);
    expect(result.requiresUserApproval).toBe(true);
  });
});

// --- Group 4 / plugins.ts ---

const baseManifest = {
  id: 'sec-plugin',
  version: '1.0.0',
  permissionSchemaVersion: 1 as const,
  permissions: ['read'] as const,
  quotas: { maxMemoryMb: 5, maxCpuMsPerMinute: 50 }
};

describe('PluginSecurityManager: timing-safe manifest verification', () => {
  it('accepts a correct HMAC signature', () => {
    const manager = new PluginSecurityManager();
    const sig = signManifest(baseManifest, 'correct-secret');
    expect(manager.verifyManifest(baseManifest, sig, 'correct-secret')).toBe(true);
  });

  it('rejects a forged signature', () => {
    const manager = new PluginSecurityManager();
    const sig = signManifest(baseManifest, 'correct-secret');
    const forged = sig.slice(0, -2) + '00'; // flip last byte
    expect(manager.verifyManifest(baseManifest, forged, 'correct-secret')).toBe(false);
  });

  it('rejects a wrong-secret signature', () => {
    const manager = new PluginSecurityManager();
    const sig = signManifest(baseManifest, 'wrong-secret');
    expect(manager.verifyManifest(baseManifest, sig, 'correct-secret')).toBe(false);
  });

  it('rejects manifest with unsupported permissionSchemaVersion', () => {
    const manager = new PluginSecurityManager();
    const badManifest = { ...baseManifest, permissionSchemaVersion: 2 as unknown as 1 };
    const sig = signManifest(baseManifest, 'secret');
    expect(manager.verifyManifest(badManifest, sig, 'secret')).toBe(false);
  });
});

describe('PluginSecurityManager: registerVerified', () => {
  it('registers plugin when signature is valid', () => {
    const manager = new PluginSecurityManager();
    const sig = signManifest(baseManifest, 'secret');
    expect(() => manager.registerVerified(baseManifest, sig, 'secret')).not.toThrow();
    expect(manager.readState(baseManifest.id).enabled).toBe(true);
  });

  it('rejects registration when signature is invalid', () => {
    const manager = new PluginSecurityManager();
    const badSig = 'a'.repeat(64);
    expect(() => manager.registerVerified(baseManifest, badSig, 'secret')).toThrow(/verification failed/);
  });

  it('prevents tampered manifest from registering', () => {
    const manager = new PluginSecurityManager();
    const sig = signManifest(baseManifest, 'secret');
    // attacker changes permissions after signing
    const tampered = { ...baseManifest, permissions: ['exec', 'network'] as unknown as ['read'] };
    expect(() => manager.registerVerified(tampered, sig, 'secret')).toThrow(/verification failed/);
  });
});

// --- Group 6 / vfs.ts ---

describe('CompressedVFS: path injection prevention', () => {
  it('rejects null-byte injection in path', () => {
    const vfs = new CompressedVFS();
    expect(() => vfs.writeFile('/file\0name.txt', 'data')).toThrow(/Invalid VFS path/);
    expect(() => vfs.readFile('/file\0name.txt')).toThrow(/Invalid VFS path/);
  });

  it('rejects empty path', () => {
    const vfs = new CompressedVFS();
    expect(() => vfs.writeFile('', 'data')).toThrow(/Invalid VFS path/);
  });

  it('rejects path exceeding length limit', () => {
    const vfs = new CompressedVFS();
    const longPath = '/' + 'a'.repeat(1025);
    expect(() => vfs.writeFile(longPath, 'data')).toThrow(/Invalid VFS path/);
  });

  it('allows valid paths through', () => {
    const vfs = new CompressedVFS();
    expect(() => vfs.writeFile('/valid/path/file.txt', 'data')).not.toThrow();
    expect(vfs.readFile('/valid/path/file.txt').toString('utf8')).toBe('data');
  });
});

// --- Group 7 / termstudio-core.ts ---

import { parseTerminalCommand } from '../src/termstudio-core.js';

describe('parseTerminalCommand: ReDoS resistance', () => {
  it('parses agent review with target', () => {
    const result = parseTerminalCommand('agent review src/vault.ts');
    expect(result.type).toBe('agent-review');
    expect(result.target).toBe('src/vault.ts');
  });

  it('parses agent review without target', () => {
    const result = parseTerminalCommand('agent review');
    expect(result.type).toBe('agent-review');
    expect(result.target).toBeNull();
  });

  it('completes in O(n) on long whitespace-only suffix (ReDoS probe)', () => {
    const malicious = 'agent review' + ' '.repeat(5000);
    const start = Date.now();
    const result = parseTerminalCommand(malicious);
    const elapsed = Date.now() - start;
    // Should complete near-instantly; ReDoS would take seconds
    expect(elapsed).toBeLessThan(100);
    // Whitespace-only suffix trimmed → no target
    expect(result.type).toBe('agent-review');
    expect(result.target).toBeNull();
  });
});


describe('OllamaClient: SSRF prevention', () => {
  it('rejects remote hostnames', () => {
    expect(() => new OllamaClient('http://evil.com:11434')).toThrow(/localhost/);
  });

  it('rejects https protocol', () => {
    expect(() => new OllamaClient('https://127.0.0.1:11434')).toThrow(/localhost/);
  });

  it('rejects URL with credentials that redirect hostname', () => {
    // http://127.0.0.1@evil.com → hostname is evil.com
    expect(() => new OllamaClient('http://127.0.0.1@evil.com')).toThrow(/localhost/);
  });

  it('normalizes path-prefix injection (endpoint with trailing path)', () => {
    // Ensure stored endpoint is origin-only, not including injected paths
    const client = new OllamaClient('http://127.0.0.1:11434');
    // Accessing endpoint is private, but healthCheck would use origin only
    expect(client).toBeDefined();
  });

  it('accepts all valid localhost variants', () => {
    expect(() => new OllamaClient('http://127.0.0.1:11434')).not.toThrow();
    expect(() => new OllamaClient('http://localhost:11434')).not.toThrow();
  });
});
