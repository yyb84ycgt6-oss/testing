import { createHash, createHmac, randomBytes } from 'node:crypto';

export type AgentCapability = 'read' | 'write' | 'exec' | 'network';

export interface PermissionRequest {
  agentId: string;
  capability: AgentCapability;
  resource: string;
  requiresDoubleCheck?: boolean;
}

export interface PermissionDecision {
  approved: boolean;
  reason: string;
  requiresUserApproval: boolean;
}

export interface AgentPolicy {
  capabilities: AgentCapability[];
  doubleCheckCapabilities?: AgentCapability[];
}

export class CapabilityPermissionEngine {
  private readonly policies = new Map<string, AgentPolicy>();

  setPolicy(agentId: string, policy: AgentPolicy): void {
    this.policies.set(agentId, {
      capabilities: [...policy.capabilities],
      doubleCheckCapabilities: [...(policy.doubleCheckCapabilities ?? [])]
    });
  }

  evaluate(request: PermissionRequest): PermissionDecision {
    const policy = this.policies.get(request.agentId);
    if (!policy) {
      return { approved: false, reason: 'No policy registered', requiresUserApproval: true };
    }

    if (!policy.capabilities.includes(request.capability)) {
      return { approved: false, reason: `Capability '${request.capability}' denied`, requiresUserApproval: true };
    }

    const requiresUserApproval =
      Boolean(request.requiresDoubleCheck) ||
      Boolean(policy.doubleCheckCapabilities?.includes(request.capability));

    return {
      approved: true,
      reason: requiresUserApproval ? 'Allowed with double-check' : 'Allowed',
      requiresUserApproval
    };
  }
}

export interface AuditPayload {
  actor: string;
  action: string;
  summary: string;
  approved: boolean;
  timestamp?: string;
}

export interface SignedAuditEntry {
  index: number;
  timestamp: string;
  actor: string;
  action: string;
  summary: string;
  approved: boolean;
  previousHash: string;
  hash: string;
  signature: string;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hmac(secret: Buffer, input: string): string {
  return createHmac('sha256', secret).update(input).digest('hex');
}

export class SignedAuditLogChain {
  private readonly entries: SignedAuditEntry[] = [];
  private readonly secret: Buffer;

  constructor(secret?: Buffer) {
    this.secret = secret ? Buffer.from(secret) : randomBytes(32);
  }

  append(payload: AuditPayload): SignedAuditEntry {
    const index = this.entries.length;
    const previousHash = this.entries.length === 0 ? 'genesis' : this.entries[this.entries.length - 1].hash;
    const timestamp = payload.timestamp ?? new Date().toISOString();
    const canonical = `${index}|${timestamp}|${payload.actor}|${payload.action}|${payload.summary}|${payload.approved}|${previousHash}`;
    const hash = sha256(canonical);
    const signature = hmac(this.secret, hash);

    const entry: SignedAuditEntry = {
      index,
      timestamp,
      actor: payload.actor,
      action: payload.action,
      summary: payload.summary,
      approved: payload.approved,
      previousHash,
      hash,
      signature
    };

    this.entries.push(entry);
    return entry;
  }

  list(): SignedAuditEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  verifyChain(): { valid: boolean; brokenIndex: number | null } {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const expectedPrev = i === 0 ? 'genesis' : this.entries[i - 1].hash;
      if (entry.previousHash !== expectedPrev || entry.index !== i) {
        return { valid: false, brokenIndex: i };
      }

      const canonical = `${entry.index}|${entry.timestamp}|${entry.actor}|${entry.action}|${entry.summary}|${entry.approved}|${entry.previousHash}`;
      const expectedHash = sha256(canonical);
      const expectedSig = hmac(this.secret, expectedHash);

      if (entry.hash !== expectedHash || entry.signature !== expectedSig) {
        return { valid: false, brokenIndex: i };
      }
    }

    return { valid: true, brokenIndex: null };
  }
}
