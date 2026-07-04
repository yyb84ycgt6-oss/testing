import { describe, it, expect, beforeEach } from "vitest";
import {
  registerAsset, listAssets, getAsset,
  createOperation, listOperations,
  queueJob, completeJob, exportResult,
  listJobs, listResults,
  _clearOpenClawStore,
} from "../src/index.ts";
import { _clearAuditStore, getAuditRecords, generateActorId } from "@command-center/shared";

const ownerCtx = { actor_id: generateActorId(), roles: ["owner"] as const };
const analystCtx = { actor_id: generateActorId(), roles: ["analyst"] as const };
const auditorCtx = { actor_id: generateActorId(), roles: ["auditor"] as const };

beforeEach(() => { _clearOpenClawStore(); _clearAuditStore(); });

describe("OpenClaw – Assets", () => {
  it("registers an asset with audit", () => {
    const a = registerAsset(ownerCtx, { name: "TargetAPI", endpoint: "https://api.example.internal", asset_class: "web" });
    expect(a.name).toBe("TargetAPI");
    expect(getAuditRecords({ module: "openclaw" }).length).toBeGreaterThan(0);
  });

  it("requires name and endpoint", () => {
    expect(() => registerAsset(ownerCtx, { name: "", endpoint: "", asset_class: "web" })).toThrow("required");
  });

  it("analyst can list assets", () => {
    registerAsset(ownerCtx, { name: "A1", endpoint: "https://a1.internal", asset_class: "api" });
    expect(listAssets(analystCtx)).toHaveLength(1);
  });

  it("auditor cannot register assets", () => {
    expect(() =>
      registerAsset(auditorCtx, { name: "X", endpoint: "https://x.internal", asset_class: "api" })
    ).toThrow("Access denied");
  });

  it("getAsset throws for unknown id", () => {
    expect(() => getAsset(ownerCtx, "nonexistent")).toThrow("not found");
  });
});

describe("OpenClaw – Operations", () => {
  it("creates operation template", () => {
    const op = createOperation(ownerCtx, { name: "PortScan", template: { ports: "1-1024" }, risk_level: "medium" });
    expect(op.name).toBe("PortScan");
    expect(op.classification).toBe("internal");
  });

  it("high-risk ops get restricted classification", () => {
    const op = createOperation(ownerCtx, { name: "Exploit", template: {}, risk_level: "high" });
    expect(op.classification).toBe("restricted");
  });

  it("analyst can list operations", () => {
    createOperation(ownerCtx, { name: "Scan", template: {}, risk_level: "low" });
    expect(listOperations(analystCtx)).toHaveLength(1);
  });
});

describe("OpenClaw – Jobs (approval-gated)", () => {
  it("denied without approval", () => {
    const op = createOperation(ownerCtx, { name: "Scan", template: {}, risk_level: "low" });
    const asset = registerAsset(ownerCtx, { name: "T1", endpoint: "https://t1", asset_class: "api" });
    expect(() =>
      queueJob(ownerCtx, { operation_id: op.asset_id, target_asset_id: asset.asset_id }, false)
    ).toThrow("denied");
  });

  it("queued with approval and emits audit", () => {
    const op = createOperation(ownerCtx, { name: "Scan", template: {}, risk_level: "low" });
    const asset = registerAsset(ownerCtx, { name: "T1", endpoint: "https://t1", asset_class: "api" });
    const job = queueJob(ownerCtx, { operation_id: op.asset_id, target_asset_id: asset.asset_id }, true);
    expect(job.status).toBe("queued");
    expect(listJobs(ownerCtx)).toHaveLength(1);
    expect(getAuditRecords({ module: "openclaw" }).some((r) => r.event_type === "openclaw.job.queued")).toBe(true);
  });

  it("throws for unknown operation", () => {
    expect(() =>
      queueJob(ownerCtx, { operation_id: "bad-id", target_asset_id: "bad" }, true)
    ).toThrow("not found");
  });
});

describe("OpenClaw – Results", () => {
  it("completes job and records result", () => {
    const op = createOperation(ownerCtx, { name: "Scan", template: {}, risk_level: "low" });
    const asset = registerAsset(ownerCtx, { name: "T1", endpoint: "https://t1", asset_class: "api" });
    const job = queueJob(ownerCtx, { operation_id: op.asset_id, target_asset_id: asset.asset_id }, true);
    const result = completeJob(ownerCtx, job.asset_id, { open_ports: [80, 443] }, 0.95);
    expect(result.confidence).toBe(0.95);
    expect(result.exported).toBe(false);
    expect(listResults(analystCtx)).toHaveLength(1);
  });

  it("rejects invalid confidence", () => {
    const op = createOperation(ownerCtx, { name: "Scan", template: {}, risk_level: "low" });
    const asset = registerAsset(ownerCtx, { name: "T1", endpoint: "https://t1", asset_class: "api" });
    const job = queueJob(ownerCtx, { operation_id: op.asset_id, target_asset_id: asset.asset_id }, true);
    expect(() => completeJob(ownerCtx, job.asset_id, {}, 1.5)).toThrow("Confidence");
  });

  it("export denied without approval", () => {
    const op = createOperation(ownerCtx, { name: "Scan", template: {}, risk_level: "low" });
    const asset = registerAsset(ownerCtx, { name: "T1", endpoint: "https://t1", asset_class: "api" });
    const job = queueJob(ownerCtx, { operation_id: op.asset_id, target_asset_id: asset.asset_id }, true);
    const result = completeJob(ownerCtx, job.asset_id, {}, 0.8);
    expect(() => exportResult(ownerCtx, result.asset_id, false)).toThrow("denied");
  });

  it("export succeeds with approval", () => {
    const op = createOperation(ownerCtx, { name: "Scan", template: {}, risk_level: "low" });
    const asset = registerAsset(ownerCtx, { name: "T1", endpoint: "https://t1", asset_class: "api" });
    const job = queueJob(ownerCtx, { operation_id: op.asset_id, target_asset_id: asset.asset_id }, true);
    const result = completeJob(ownerCtx, job.asset_id, {}, 0.8);
    const exported = exportResult(ownerCtx, result.asset_id, true);
    expect(exported.exported).toBe(true);
  });

  it("auditor cannot list results", () => {
    expect(() => listResults(auditorCtx)).toThrow("Access denied");
  });
});
