import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import type { BlobMetadata, EncryptedBlob } from './types.js';

const VERSION = 1;
const KDF_ITERATIONS = 210_000;

function b64(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64');
}

function fromB64(input: string): Buffer {
  return Buffer.from(input, 'base64');
}

function toKey(masterPassword: string, salt: Buffer, iterations: number): Buffer {
  return pbkdf2Sync(masterPassword, salt, iterations, 32, 'sha256');
}

export function encryptPayload(masterPassword: string, payload: unknown): EncryptedBlob {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = toKey(masterPassword, salt, KDF_ITERATIONS);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const joined = Buffer.concat([ciphertext, authTag]);

  key.fill(0);

  const metadata: BlobMetadata = {
    version: VERSION,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: KDF_ITERATIONS,
      saltB64: b64(salt)
    },
    cipher: {
      name: 'AES-GCM',
      ivB64: b64(iv),
      tagLength: 128
    }
  };

  return {
    metadata,
    ciphertextB64: b64(joined)
  };
}

export function decryptPayload<T>(masterPassword: string, blob: EncryptedBlob): T {
  assertSupportedMetadata(blob.metadata);

  const salt = fromB64(blob.metadata.kdf.saltB64);
  const iv = fromB64(blob.metadata.cipher.ivB64);
  const joined = fromB64(blob.ciphertextB64);

  if (joined.length <= 16) {
    throw new Error('Malformed ciphertext');
  }

  const key = toKey(masterPassword, salt, blob.metadata.kdf.iterations);
  const ciphertext = joined.subarray(0, joined.length - 16);
  const tag = joined.subarray(joined.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  } finally {
    key.fill(0);
  }
}

export function assertSupportedMetadata(metadata: BlobMetadata): void {
  if (metadata.version !== VERSION) throw new Error('Unsupported metadata version');
  if (metadata.kdf.name !== 'PBKDF2' || metadata.kdf.hash !== 'SHA-256') throw new Error('Unsupported KDF');
  if (metadata.kdf.iterations < 200_000) throw new Error('Weak KDF iterations');
  if (metadata.cipher.name !== 'AES-GCM' || metadata.cipher.tagLength !== 128) {
    throw new Error('Unsupported cipher');
  }
}

export function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
