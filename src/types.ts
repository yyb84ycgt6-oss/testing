export type VaultState = 'locked' | 'unlocking' | 'unlocked' | 'relocking' | 'error';

export interface KdfMetadata {
  name: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  saltB64: string;
}

export interface CipherMetadata {
  name: 'AES-GCM';
  ivB64: string;
  tagLength: 128;
}

export interface BlobMetadata {
  version: 1;
  kdf: KdfMetadata;
  cipher: CipherMetadata;
}

export interface EncryptedBlob {
  metadata: BlobMetadata;
  ciphertextB64: string;
}

export interface VaultPackage {
  version: 1;
  domains: {
    boxes: EncryptedBlob;
    aiSettings: EncryptedBlob;
    aiSeed: EncryptedBlob;
    metadata: EncryptedBlob;
  };
  publicMetadata: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface AISettings {
  selectedModel: string;
}

export interface DecryptedVault {
  boxes: Record<string, unknown>;
  aiSettings: AISettings;
  aiSeed: string;
  metadata: Record<string, unknown>;
}
