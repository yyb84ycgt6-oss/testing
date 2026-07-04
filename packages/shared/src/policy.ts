import crypto from "node:crypto";
import type { PolicyDecision, PolicyOutcome, ActionEnvelope } from "./types.ts";
import { checkAccess, type AccessContext } from "./rbac.ts";

/**
 * Policy engine — evaluates every action request before dispatch.
 * Returns an immutable PolicyDecision; never throws on deny.
 */

const HIGH_RISK_ACTIONS = new Set([
  "pc.device.write", "pc.session.execute",
  "flipper.profile.write", "flipper.payload.approve",
  "flipper.cloud.sync", "flipper.bluetooth.pair",
  "flipper.wifi.connect", "flipper.device.write",
  "openclaw.operation.execute",
  "asset.export", "workflow.execute",
]);

export interface PolicyRequest {
  readonly action_id: string;
  readonly permission: string;
  readonly ctx: AccessContext;
  readonly approved?: boolean; // explicit approval token present
}

export function evaluatePolicy(req: PolicyRequest): PolicyDecision {
  const access = checkAccess(req.ctx, req.permission);

  let outcome: PolicyOutcome;
  let reason: string;

  if (!access.granted) {
    outcome = "deny";
    reason = `Permission not held: ${req.permission}`;
  } else if (HIGH_RISK_ACTIONS.has(req.permission) && !req.approved) {
    outcome = "require_approval";
    reason = `High-risk action requires explicit approval: ${req.permission}`;
  } else {
    outcome = "allow";
    reason = access.reason;
  }

  return Object.freeze<PolicyDecision>({
    decision_id: crypto.randomUUID(),
    action_id: req.action_id,
    outcome,
    reason,
    evaluated_at: new Date().toISOString(),
    evaluated_by: "policy_engine",
  });
}

export function applyPolicy<TIn, TOut>(
  envelope: ActionEnvelope<TIn, TOut>,
  decision: PolicyDecision
): ActionEnvelope<TIn, TOut> {
  return {
    ...envelope,
    policy_decision: decision,
    status:
      decision.outcome === "allow"
        ? "approved"
        : decision.outcome === "require_approval"
        ? "pending"
        : "denied",
  };
}
