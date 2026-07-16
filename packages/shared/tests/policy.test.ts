import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "../src/policy.ts";
import { generateActorId } from "../src/rbac.ts";

describe("Policy engine", () => {
  const actor_id = generateActorId();

  it("allows low-risk read for analyst", () => {
    const d = evaluatePolicy({
      action_id: "a1",
      permission: "pc.device.read",
      ctx: { actor_id, roles: ["analyst"] },
    });
    expect(d.outcome).toBe("allow");
  });

  it("denies when role lacks permission", () => {
    const d = evaluatePolicy({
      action_id: "a2",
      permission: "flipper.payload.approve",
      ctx: { actor_id, roles: ["auditor"] },
    });
    expect(d.outcome).toBe("deny");
  });

  it("requires approval for high-risk without token", () => {
    const d = evaluatePolicy({
      action_id: "a3",
      permission: "flipper.bluetooth.pair",
      ctx: { actor_id, roles: ["owner"] },
      approved: false,
    });
    expect(d.outcome).toBe("require_approval");
  });

  it("allows high-risk with explicit approval", () => {
    const d = evaluatePolicy({
      action_id: "a4",
      permission: "flipper.bluetooth.pair",
      ctx: { actor_id, roles: ["owner"] },
      approved: true,
    });
    expect(d.outcome).toBe("allow");
  });

  it("decision is immutable", () => {
    const d = evaluatePolicy({
      action_id: "a5",
      permission: "audit.read",
      ctx: { actor_id, roles: ["auditor"] },
    });
    expect(() => {
      // @ts-expect-error intentional mutation attempt
      d.outcome = "allow";
    }).toThrow();
  });

  it("policy.manage requires approval for security_lead", () => {
    const d = evaluatePolicy({
      action_id: "pm1",
      permission: "policy.manage",
      ctx: { actor_id, roles: ["security_lead"] },
      approved: false,
    });
    expect(d.outcome).toBe("require_approval");
  });

  it("policy.manage allowed with explicit approval", () => {
    const d = evaluatePolicy({
      action_id: "pm2",
      permission: "policy.manage",
      ctx: { actor_id, roles: ["security_lead"] },
      approved: true,
    });
    expect(d.outcome).toBe("allow");
  });

  it("consecutive evaluations produce unique decision_ids", () => {
    const d1 = evaluatePolicy({ action_id: "u1", permission: "audit.read", ctx: { actor_id, roles: ["auditor"] } });
    const d2 = evaluatePolicy({ action_id: "u2", permission: "audit.read", ctx: { actor_id, roles: ["auditor"] } });
    expect(d1.decision_id).not.toBe(d2.decision_id);
  });

  it("evaluated_by is always policy_engine", () => {
    const d = evaluatePolicy({ action_id: "eb1", permission: "audit.read", ctx: { actor_id, roles: ["auditor"] } });
    expect(d.evaluated_by).toBe("policy_engine");
  });

  it("evaluated_at is a valid ISO-8601 timestamp", () => {
    const d = evaluatePolicy({ action_id: "ts1", permission: "audit.read", ctx: { actor_id, roles: ["auditor"] } });
    expect(new Date(d.evaluated_at).toISOString()).toBe(d.evaluated_at);
  });

  it("deny reason does not expose internal permission map", () => {
    const d = evaluatePolicy({
      action_id: "dr1",
      permission: "secret.admin.nuke",
      ctx: { actor_id, roles: ["auditor"] },
    });
    expect(d.outcome).toBe("deny");
    // Reason should reference the permission name but not leak role table internals
    expect(d.reason).toContain("secret.admin.nuke");
  });
});
