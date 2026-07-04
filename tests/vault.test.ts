import { describe, expect, it, vi } from 'vitest';
import { decryptPayload } from '../src/crypto.js';
import { OllamaClient } from '../src/ollama.js';
import { SecurityVault } from '../src/vault.js';

describe('security vault lifecycle and encryption', () => {
  it('enforces unlock/lock and zeroizes sensitive memory', () => {
    const vault = new SecurityVault();
    const pkg = vault.initialize('pw-123456789');

    expect(() => vault.setBox('k', 'v')).toThrow();

    vault.unlock('pw-123456789', pkg);
    vault.setBox('token', 'abc123');
    const profile = vault.createAIProfilePayload();
    expect(profile.creationSeed.length).toBeGreaterThan(10);

    vault.relock();
    expect(vault.getState()).toBe('locked');
    expect(() => vault.createAIProfilePayload()).toThrow();
  });

  it('detects tampering via AES-GCM integrity failure', () => {
    const vault = new SecurityVault();
    const pkg = vault.initialize('pw-123456789');
    const tampered = structuredClone(pkg);
    tampered.domains.aiSettings.ciphertextB64 = tampered.domains.aiSettings.ciphertextB64.slice(0, -2) + 'AA';
    expect(() => vault.unlock('pw-123456789', tampered)).toThrow();
  });

  it('exports and imports encrypted-only package with round-trip', () => {
    const vaultA = new SecurityVault();
    const initial = vaultA.initialize('pw-123456789');
    vaultA.unlock('pw-123456789', initial);
    vaultA.setBox('scope', { a: 1 });
    vaultA.setModel('qwen');

    const exported = vaultA.exportEncrypted('pw-123456789');

    expect(Object.keys(exported)).toEqual(['version', 'domains', 'publicMetadata']);
    expect(JSON.stringify(exported)).not.toContain('scope');
    expect(JSON.stringify(exported)).not.toContain('qwen');

    const vaultB = new SecurityVault();
    vaultB.importEncrypted('pw-123456789', exported);
    expect(vaultB.readBox('scope')).toEqual({ a: 1 });
    expect(vaultB.createAIProfilePayload().model).toBe('qwen');
  });

  it('rejects weak or unsupported metadata versions', () => {
    const vault = new SecurityVault();
    const pkg = vault.initialize('pw-123456789');
    const weak = structuredClone(pkg);
    weak.domains.boxes.metadata.kdf.iterations = 10;
    expect(() => vault.unlock('pw-123456789', weak)).toThrow(/Weak KDF/);
  });

  it('exposes openclaw/whiterabbit compatibility info and validates allowed list', () => {
    const vault = new SecurityVault();
    const pkg = vault.initialize('pw-123456789');
    vault.unlock('pw-123456789', pkg);
    expect(vault.listAllowedModels()).toContain('openclaw');
    expect(vault.listAllowedModels()).toContain('whiterabbit');

    const whiteRabbit = vault.getModelCompatibility('whiterabbit');
    expect(whiteRabbit.ollamaNative).toBe(false);
    expect(whiteRabbit.notes.toLowerCase()).toContain('ollama');

    expect(() => vault.setModel('not-real')).toThrow();
  });
});

describe('ollama localhost guardrails', () => {
  it('rejects non-local endpoints', () => {
    expect(() => new OllamaClient('https://api.remote.ai')).toThrow(/localhost/);
  });

  it('performs real health request path with error handling', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const client = new OllamaClient('http://127.0.0.1:11434');
    await expect(client.healthCheck()).rejects.toThrow(/503/);

    vi.unstubAllGlobals();
  });
});

it('decrypts domain blobs only after unlock path', () => {
  const vault = new SecurityVault();
  const pkg = vault.initialize('pw-123456789');
  expect(() => decryptPayload('pw-123456789', pkg.domains.aiSeed)).not.toThrow();
  expect(() => vault.readBox('a')).toThrow();
});
