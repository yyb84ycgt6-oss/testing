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
  });
});
