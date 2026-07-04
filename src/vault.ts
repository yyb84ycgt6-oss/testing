import { randomUUID } from 'node:crypto';
import { decryptPayload, encryptPayload } from './crypto.js';
import { getModelRegistry, validateModelSelection } from './models.js';
import type { DecryptedVault, VaultPackage, VaultState } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

function zeroizeString(value: string): string {
  return '\0'.repeat(value.length);
}

export class SecurityVault {
  private state: VaultState = 'locked';
  private decrypted: DecryptedVault | null = null;
  private activeSessionSecret: string | null = null;

  initialize(masterPassword: string): VaultPackage {
    this.ensureState('locked');
    const seed = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    const createdAt = nowIso();
    const payload: DecryptedVault = {
      boxes: {},
      aiSettings: { selectedModel: 'llama' },
      aiSeed: seed,
      metadata: { initializedAt: createdAt }
    };
    return this.encryptAll(masterPassword, payload, createdAt, createdAt);
  }

  unlock(masterPassword: string, vaultPackage: VaultPackage): void {
    this.ensureState('locked');
    this.state = 'unlocking';
    try {
      this.decrypted = {
        boxes: decryptPayload(masterPassword, vaultPackage.domains.boxes),
        aiSettings: decryptPayload(masterPassword, vaultPackage.domains.aiSettings),
        aiSeed: decryptPayload(masterPassword, vaultPackage.domains.aiSeed),
        metadata: decryptPayload(masterPassword, vaultPackage.domains.metadata)
      };
      validateModelSelection(this.decrypted.aiSettings.selectedModel);
      this.activeSessionSecret = randomUUID();
      this.state = 'unlocked';
    } catch (error) {
      this.state = 'error';
      this.zeroizeMemory();
      throw error;
    }
  }

  relock(): void {
    if (this.state !== 'unlocked') throw new Error('Vault must be unlocked to relock');
    this.state = 'relocking';
    this.zeroizeMemory();
    this.state = 'locked';
  }

  exportEncrypted(masterPassword: string): VaultPackage {
    this.ensureState('unlocked');
    if (!this.decrypted) throw new Error('Missing decrypted data');
    const createdAt = this.decrypted.metadata.initializedAt as string | undefined;
    return this.encryptAll(masterPassword, this.decrypted, createdAt ?? nowIso(), nowIso());
  }

  importEncrypted(masterPassword: string, incoming: VaultPackage): void {
    if (incoming.version !== 1) throw new Error('Unsupported vault package version');
    this.unlock(masterPassword, incoming);
  }

  getState(): VaultState {
    return this.state;
  }

  listAllowedModels(): string[] {
    this.ensureState('unlocked');
    return getModelRegistry().map((m) => m.id);
  }

  getModelCompatibility(modelId: string): { notes: string; ollamaNative: boolean } {
    const model = validateModelSelection(modelId);
    return { notes: model.compatibility.notes, ollamaNative: model.compatibility.ollamaNative };
  }

  setModel(modelId: string): void {
    this.ensureState('unlocked');
    const model = validateModelSelection(modelId);
    if (!this.decrypted) throw new Error('Missing decrypted data');
    this.decrypted.aiSettings.selectedModel = model.id;
  }

  setBox(key: string, value: unknown): void {
    this.ensureState('unlocked');
    if (!this.decrypted) throw new Error('Missing decrypted data');
    this.decrypted.boxes[key] = value;
  }

  readBox(key: string): unknown {
    this.ensureState('unlocked');
    return this.decrypted?.boxes[key];
  }

  createAIProfilePayload(): { model: string; creationSeed: string } {
    this.ensureState('unlocked');
    if (!this.decrypted) throw new Error('Missing decrypted data');
    return {
      model: this.decrypted.aiSettings.selectedModel,
      creationSeed: this.decrypted.aiSeed
    };
  }

  private ensureState(expected: VaultState): void {
    if (this.state !== expected) {
      throw new Error(`Vault state must be '${expected}', got '${this.state}'`);
    }
  }

  private encryptAll(masterPassword: string, payload: DecryptedVault, createdAt: string, updatedAt: string): VaultPackage {
    return {
      version: 1,
      domains: {
        boxes: encryptPayload(masterPassword, payload.boxes),
        aiSettings: encryptPayload(masterPassword, payload.aiSettings),
        aiSeed: encryptPayload(masterPassword, payload.aiSeed),
        metadata: encryptPayload(masterPassword, payload.metadata)
      },
      publicMetadata: {
        createdAt,
        updatedAt
      }
    };
  }

  private zeroizeMemory(): void {
    if (this.decrypted) {
      this.decrypted.aiSeed = zeroizeString(this.decrypted.aiSeed);
      this.decrypted.aiSettings.selectedModel = zeroizeString(this.decrypted.aiSettings.selectedModel);
      this.decrypted.boxes = {};
      this.decrypted.metadata = {};
      this.decrypted = null;
    }
    if (this.activeSessionSecret) {
      this.activeSessionSecret = zeroizeString(this.activeSessionSecret);
      this.activeSessionSecret = null;
    }
  }
}
