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
});
