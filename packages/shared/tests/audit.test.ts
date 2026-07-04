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
});
