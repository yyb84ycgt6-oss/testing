import { describe, it, expect, beforeEach } from "vitest";
import { checkAccess, assertAccess, generateActorId } from "../src/rbac.ts";

describe("RBAC", () => {
  const actor_id = generateActorId();

  describe("checkAccess", () => {
    it("denies with no roles", () => {
      const r = checkAccess({ actor_id, roles: [] }, "pc.device.read");
      expect(r.granted).toBe(false);
    });

    it("auditor can read audit log", () => {
      const r = checkAccess({ actor_id, roles: ["auditor"] }, "audit.read");
      expect(r.granted).toBe(true);
      expect(r.requires_approval).toBe(false);
    });

    it("auditor cannot execute sessions", () => {
      const r = checkAccess({ actor_id, roles: ["auditor"] }, "pc.session.execute");
      expect(r.granted).toBe(false);
    });

    it("operator can execute flipper sync (requires approval)", () => {
      const r = checkAccess({ actor_id, roles: ["operator"] }, "flipper.sync.execute");
      expect(r.granted).toBe(true);
    });

    it("owner has wildcard access", () => {
      const r = checkAccess({ actor_id, roles: ["owner"] }, "openclaw.operation.execute");
      expect(r.granted).toBe(true);
    });

    it("high-risk permission flags requires_approval", () => {
      const r = checkAccess({ actor_id, roles: ["owner"] }, "flipper.bluetooth.pair");
      expect(r.granted).toBe(true);
      expect(r.requires_approval).toBe(true);
    });

    it("analyst read-only access across modules", () => {
      for (const p of ["pc.device.read", "flipper.profile.read", "openclaw.result.read"]) {
        expect(checkAccess({ actor_id, roles: ["analyst"] }, p).granted).toBe(true);
      }
    });

    it("denies when actor_id is empty string", () => {
      const r = checkAccess({ actor_id: "", roles: ["analyst"] }, "pc.device.read");
      expect(r.granted).toBe(false);
      expect(r.reason).toMatch(/No identity/);
    });

    it("multi-role union: operator + analyst covers both permission sets", () => {
      const ctx = { actor_id, roles: ["operator", "analyst"] as const };
      expect(checkAccess(ctx, "pc.device.read").granted).toBe(true);   // analyst
      expect(checkAccess(ctx, "pc.session.execute").granted).toBe(true); // operator
    });

    it("security_lead has policy.manage flagged as requires_approval", () => {
      const r = checkAccess({ actor_id, roles: ["security_lead"] }, "policy.manage");
      expect(r.granted).toBe(true);
      expect(r.requires_approval).toBe(true);
    });

    it("team_manager cannot execute sessions or workflows", () => {
      const ctx = { actor_id, roles: ["team_manager"] as const };
      expect(checkAccess(ctx, "pc.session.execute").granted).toBe(false);
      expect(checkAccess(ctx, "workflow.execute").granted).toBe(false);
    });

    it("analyst cannot write to any module", () => {
      const ctx = { actor_id, roles: ["analyst"] as const };
      for (const p of ["pc.device.write", "flipper.device.write", "openclaw.operation.execute"]) {
        expect(checkAccess(ctx, p).granted).toBe(false);
      }
    });
  });

  describe("assertAccess", () => {
    it("throws on denied permission", () => {
      expect(() =>
        assertAccess({ actor_id, roles: ["auditor"] }, "flipper.payload.approve")
      ).toThrow("Access denied");
    });

    it("does not throw when granted", () => {
      expect(() =>
        assertAccess({ actor_id, roles: ["analyst"] }, "audit.read")
      ).not.toThrow();
    });

    it("error message does not contain actor_id", () => {
      const specificId = generateActorId();
      try {
        assertAccess({ actor_id: specificId, roles: ["auditor"] }, "pc.device.write");
        expect.fail("should have thrown");
      } catch (e) {
        expect((e as Error).message).not.toContain(specificId);
      }
    });
  });
});
