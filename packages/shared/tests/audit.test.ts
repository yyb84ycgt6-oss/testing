import { describe, it, expect, beforeEach } from "vitest";
import { recordAudit, getAuditRecords, _clearAuditStore } from "../src/audit.ts";

describe("Audit", () => {
  beforeEach(() => _clearAuditStore());

  it("creates immutable records with generated ids", () => {
    const r = recordAudit({
      action_id: "a1",
      actor_id: "u1",
      module: "pc",
      event_type: "pc.session.started",
      outcome: "success",
      detail: { session: "s1" },
    });
    expect(r.audit_id).toBeTruthy();
    expect(r.recorded_at).toBeTruthy();
    expect(() => {
      // @ts-expect-error intentional mutation attempt
      r.actor_id = "evil";
    }).toThrow();
  });

  it("filters by actor_id", () => {
    recordAudit({ action_id: "a1", actor_id: "u1", module: "pc", event_type: "x", outcome: "success", detail: {} });
    recordAudit({ action_id: "a2", actor_id: "u2", module: "pc", event_type: "x", outcome: "success", detail: {} });
    expect(getAuditRecords({ actor_id: "u1" })).toHaveLength(1);
  });

  it("filters by outcome", () => {
    recordAudit({ action_id: "a1", actor_id: "u1", module: "pc", event_type: "x", outcome: "success", detail: {} });
    recordAudit({ action_id: "a2", actor_id: "u1", module: "pc", event_type: "x", outcome: "denied", detail: {} });
    expect(getAuditRecords({ outcome: "denied" })).toHaveLength(1);
  });

  it("returns all records unfiltered", () => {
    recordAudit({ action_id: "a1", actor_id: "u1", module: "flipper", event_type: "x", outcome: "success", detail: {} });
    recordAudit({ action_id: "a2", actor_id: "u2", module: "openclaw", event_type: "x", outcome: "success", detail: {} });
    expect(getAuditRecords()).toHaveLength(2);
  });

  it("filters by module", () => {
    recordAudit({ action_id: "a1", actor_id: "u1", module: "flipper", event_type: "x", outcome: "success", detail: {} });
    recordAudit({ action_id: "a2", actor_id: "u1", module: "pc", event_type: "x", outcome: "success", detail: {} });
    expect(getAuditRecords({ module: "flipper" })).toHaveLength(1);
    expect(getAuditRecords({ module: "pc" })).toHaveLength(1);
  });

  it("filters by since timestamp", () => {
    const past = new Date(Date.now() - 10000).toISOString();
    const future = new Date(Date.now() + 10000).toISOString();
    recordAudit({ action_id: "a1", actor_id: "u1", module: "pc", event_type: "x", outcome: "success", detail: {} });
    expect(getAuditRecords({ since: past })).toHaveLength(1);
    expect(getAuditRecords({ since: future })).toHaveLength(0);
  });

  it("detail object is frozen — mutation throws in strict mode", () => {
    const r = recordAudit({ action_id: "a1", actor_id: "u1", module: "pc", event_type: "x", outcome: "success", detail: { key: "value" } });
    expect(() => {
      // @ts-expect-error intentional mutation attempt
      r.detail.key = "mutated";
    }).toThrow();
  });

  it("records accumulate across multiple calls", () => {
    for (let i = 0; i < 5; i++) {
      recordAudit({ action_id: `a${i}`, actor_id: "u1", module: "pc", event_type: "x", outcome: "success", detail: {} });
    }
    expect(getAuditRecords()).toHaveLength(5);
  });

  it("each audit_id is unique", () => {
    recordAudit({ action_id: "a1", actor_id: "u1", module: "pc", event_type: "x", outcome: "success", detail: {} });
    recordAudit({ action_id: "a2", actor_id: "u1", module: "pc", event_type: "x", outcome: "success", detail: {} });
    const records = getAuditRecords();
    expect(records[0]!.audit_id).not.toBe(records[1]!.audit_id);
  });
});
