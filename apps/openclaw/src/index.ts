import crypto from "node:crypto";
import type { Asset } from "@command-center/shared";
import {
  assertAccess,
  evaluatePolicy,
  recordAudit,
  type AccessContext,
} from "@command-center/shared";

// ─── Entity types ─────────────────────────────────────────────────────────────

export interface OpenClawAsset extends Asset {
  readonly asset_type: "openclaw_asset";
  readonly module: "openclaw";
  name: string;
  endpoint: string;
  asset_class: string;
}

export interface OpenClawOperation extends Asset {
  readonly asset_type: "openclaw_operation";
  readonly module: "openclaw";
  name: string;
  template: Readonly<Record<string, unknown>>;
  risk_level: "low" | "medium" | "high";
}

export interface OpenClawJob extends Asset {
  readonly asset_type: "openclaw_job";
  readonly module: "openclaw";
  readonly operation_id: string;
  readonly target_asset_id: string;
  status: "queued" | "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
}

export interface OpenClawResult extends Asset {
  readonly asset_type: "openclaw_result";
  readonly module: "openclaw";
  readonly job_id: string;
  output: Readonly<Record<string, unknown>>;
  confidence: number; // 0–1
  exported: boolean;
}

// ─── Stores ───────────────────────────────────────────────────────────────────

const _assets = new Map<string, OpenClawAsset>();
const _operations = new Map<string, OpenClawOperation>();
const _jobs = new Map<string, OpenClawJob>();
const _results = new Map<string, OpenClawResult>();

// ─── Validation ───────────────────────────────────────────────────────────────

function validateConfidence(c: number): void {
  if (c < 0 || c > 1) throw new Error("Confidence must be between 0 and 1.");
}

function validateEndpoint(url: string): void {
  if (!url || url.length === 0) throw new Error("Endpoint is required.");
  if (url.length > 2048) throw new Error("Endpoint URL exceeds maximum length.");
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Endpoint must use http or https protocol.");
    }
  } catch (e) {
    // Check if it's a protocol error we threw
    if (e instanceof Error && e.message.includes("http or https")) {
      throw e;
    }
    throw new Error("Endpoint is not a valid URL.");
  }
}

function requireApprovalGate(ctx: AccessContext, permission: string, approved: boolean): void {
  const decision = evaluatePolicy({ action_id: crypto.randomUUID(), permission, ctx, approved });
  recordAudit({
    action_id: decision.action_id,
    actor_id: ctx.actor_id,
    module: "openclaw",
    event_type: "policy.decision.recorded",
    outcome: decision.outcome === "allow" ? "success" : "denied",
    detail: { permission, outcome: decision.outcome },
  });
  if (decision.outcome !== "allow") {
    throw new Error(`Action denied: ${decision.reason}`);
  }
}

// ─── Asset registry ───────────────────────────────────────────────────────────

export function registerAsset(
  ctx: AccessContext,
  input: { name: string; endpoint: string; asset_class: string }
): OpenClawAsset {
  assertAccess(ctx, "openclaw.asset.write");
  if (!input.name) throw new Error("Name and endpoint required.");
  validateEndpoint(input.endpoint);

  const now = new Date().toISOString();
  const asset: OpenClawAsset = {
    asset_id: crypto.randomUUID(),
    asset_type: "openclaw_asset",
    module: "openclaw",
    owner_id: ctx.actor_id,
    classification: "internal",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    name: input.name,
    endpoint: input.endpoint,
    asset_class: input.asset_class,
  };
  _assets.set(asset.asset_id, asset);
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "openclaw",
    event_type: "openclaw.asset.registered",
    outcome: "success",
    detail: { asset_id: asset.asset_id, name: asset.name },
  });
  return asset;
}

export function listAssets(ctx: AccessContext): readonly OpenClawAsset[] {
  assertAccess(ctx, "openclaw.asset.read");
  return Array.from(_assets.values()).filter((a) => a.status !== "archived");
}

export function getAsset(ctx: AccessContext, asset_id: string): OpenClawAsset {
  assertAccess(ctx, "openclaw.asset.read");
  const a = _assets.get(asset_id);
  if (!a) throw new Error(`Asset not found: ${asset_id}`);
  return a;
}

// ─── Operation templates ──────────────────────────────────────────────────────

export function createOperation(
  ctx: AccessContext,
  input: { name: string; template: Record<string, unknown>; risk_level: OpenClawOperation["risk_level"] }
): OpenClawOperation {
  assertAccess(ctx, "openclaw.operation.write");
  if (!input.name) throw new Error("Operation name required.");

  const now = new Date().toISOString();
  const op: OpenClawOperation = {
    asset_id: crypto.randomUUID(),
    asset_type: "openclaw_operation",
    module: "openclaw",
    owner_id: ctx.actor_id,
    classification: input.risk_level === "high" ? "restricted" : "internal",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    name: input.name,
    template: Object.freeze({ ...input.template }),
    risk_level: input.risk_level,
  };
  _operations.set(op.asset_id, op);
  return op;
}

export function listOperations(ctx: AccessContext): readonly OpenClawOperation[] {
  assertAccess(ctx, "openclaw.operation.read");
  return Array.from(_operations.values()).filter((o) => o.status === "active");
}

// ─── Job execution ────────────────────────────────────────────────────────────

export function queueJob(
  ctx: AccessContext,
  input: { operation_id: string; target_asset_id: string },
  approved = false
): OpenClawJob {
  requireApprovalGate(ctx, "openclaw.operation.execute", approved);

  const op = _operations.get(input.operation_id);
  if (!op) throw new Error(`Operation not found: ${input.operation_id}`);

  const now = new Date().toISOString();
  const job: OpenClawJob = {
    asset_id: crypto.randomUUID(),
    asset_type: "openclaw_job",
    module: "openclaw",
    owner_id: ctx.actor_id,
    classification: op.risk_level === "high" ? "restricted" : "internal",
    tags: [],
    created_at: now,
    updated_at: now,
    operation_id: input.operation_id,
    target_asset_id: input.target_asset_id,
    status: "queued",
    started_at: null,
    completed_at: null,
  };
  _jobs.set(job.asset_id, job);
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "openclaw",
    event_type: "openclaw.job.queued",
    outcome: "success",
    detail: { job_id: job.asset_id, operation_id: op.asset_id },
  });
  return job;
}

export function completeJob(
  ctx: AccessContext,
  job_id: string,
  output: Record<string, unknown>,
  confidence: number
): OpenClawResult {
  assertAccess(ctx, "openclaw.operation.read");
  validateConfidence(confidence);

  const job = _jobs.get(job_id);
  if (!job) throw new Error(`Job not found: ${job_id}`);

  const now = new Date().toISOString();
  job.status = "completed";
  job.completed_at = now;
  job.updated_at = now;

  const result: OpenClawResult = {
    asset_id: crypto.randomUUID(),
    asset_type: "openclaw_result",
    module: "openclaw",
    owner_id: ctx.actor_id,
    classification: "internal",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    job_id,
    output: Object.freeze({ ...output }),
    confidence,
    exported: false,
  };
  _results.set(result.asset_id, result);
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "openclaw",
    event_type: "openclaw.operation.finished",
    outcome: "success",
    detail: { result_id: result.asset_id, job_id, confidence },
  });
  return result;
}

export function exportResult(
  ctx: AccessContext,
  result_id: string,
  approved = false
): OpenClawResult {
  requireApprovalGate(ctx, "asset.export", approved);
  const result = _results.get(result_id);
  if (!result) throw new Error(`Result not found: ${result_id}`);
  result.exported = true;
  result.updated_at = new Date().toISOString();
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "openclaw",
    event_type: "openclaw.result.exported",
    outcome: "success",
    detail: { result_id },
  });
  return result;
}

export function listJobs(ctx: AccessContext): readonly OpenClawJob[] {
  assertAccess(ctx, "openclaw.operation.read");
  return Array.from(_jobs.values());
}

export function listResults(ctx: AccessContext): readonly OpenClawResult[] {
  assertAccess(ctx, "openclaw.result.read");
  return Array.from(_results.values());
}

/** For testing only. */
export function _clearOpenClawStore(): void {
  _assets.clear();
  _operations.clear();
  _jobs.clear();
  _results.clear();
}
