import crypto from "node:crypto";
import type { Role, Permission } from "./types.ts";

/**
 * RBAC engine — deny-by-default, least-privilege.
 * All permission checks are logged; failures never expose internals.
 */

// ─── Role → Permission map ────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  owner: [
    // Full access: 3-segment (module.resource.verb) and 2-segment (domain.verb)
    "*.*.*", "*.*",
  ],
  security_lead: [
    "pc.device.read", "pc.session.read", "pc.file.read",
    "flipper.device.read", "flipper.profile.read", "flipper.payload.read", "flipper.sync.read",
    "openclaw.asset.read", "openclaw.operation.read", "openclaw.result.read",
    "audit.read", "asset.export",
    "workflow.create", "workflow.execute",
    "policy.manage",
  ],
  ops_lead: [
    "pc.device.read", "pc.session.read", "pc.session.execute", "pc.file.read",
    "flipper.device.read", "flipper.profile.read", "flipper.sync.read", "flipper.sync.execute",
    "openclaw.asset.read", "openclaw.operation.read", "openclaw.result.read",
    "workflow.create", "workflow.execute",
    "audit.read",
  ],
  team_manager: [
    "pc.device.read", "pc.session.read",
    "flipper.device.read", "flipper.profile.read",
    "openclaw.asset.read", "openclaw.operation.read",
    "workflow.create",
    "audit.read",
  ],
  analyst: [
    "pc.device.read", "pc.session.read", "pc.file.read",
    "flipper.device.read", "flipper.profile.read", "flipper.sync.read",
    "openclaw.asset.read", "openclaw.operation.read", "openclaw.result.read",
    "audit.read",
  ],
  operator: [
    "pc.device.read", "pc.session.execute",
    "flipper.device.read", "flipper.profile.read", "flipper.sync.execute",
    "openclaw.asset.read", "openclaw.operation.execute",
    "workflow.execute",
  ],
  auditor: [
    "audit.read",
    "pc.device.read", "flipper.device.read", "openclaw.asset.read",
  ],
};

// ─── High-risk actions that always require explicit approval ──────────────────

const HIGH_RISK_PERMISSIONS = new Set<Permission>([
  "pc.device.write", "pc.session.execute",
  "flipper.profile.write", "flipper.payload.approve",
  "flipper.cloud.sync", "flipper.bluetooth.pair",
  "flipper.wifi.connect", "flipper.device.write",
  "openclaw.operation.execute",
  "asset.export", "policy.manage",
  "workflow.execute",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchesWildcard(pattern: Permission, permission: Permission): boolean {
  if (pattern === permission) return true;
  const pParts = pattern.split(".");
  const rParts = permission.split(".");
  // Patterns must have same segment count as the permission, or use a leading *
  if (pParts.length !== rParts.length) return false;
  return pParts.every((p, i) => p === "*" || p === rParts[i]!);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AccessContext {
  readonly actor_id: string;
  readonly roles: readonly Role[];
}

export interface AccessResult {
  readonly granted: boolean;
  readonly requires_approval: boolean;
  readonly reason: string;
}

export function checkAccess(
  ctx: AccessContext,
  permission: Permission
): AccessResult {
  if (!ctx.actor_id || ctx.roles.length === 0) {
    return { granted: false, requires_approval: false, reason: "No identity or roles provided." };
  }

  const allPerms = ctx.roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []);
  const hasPermission = allPerms.some((p) => matchesWildcard(p, permission));

  if (!hasPermission) {
    return { granted: false, requires_approval: false, reason: `Permission denied: ${permission}` };
  }

  const requiresApproval = HIGH_RISK_PERMISSIONS.has(permission);
  return {
    granted: true,
    requires_approval: requiresApproval,
    reason: requiresApproval
      ? `Granted with approval gate: ${permission}`
      : `Granted: ${permission}`,
  };
}

export function assertAccess(ctx: AccessContext, permission: Permission): void {
  const result = checkAccess(ctx, permission);
  if (!result.granted) {
    // Do NOT include actor details in the thrown message to avoid leaking PII in logs.
    throw new Error(`Access denied for permission: ${permission}`);
  }
}

export function generateActorId(): string {
  return crypto.randomUUID();
}
