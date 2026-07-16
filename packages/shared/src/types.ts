/**
 * Core domain types shared across all Command Center modules.
 * No secrets, credentials, or PII are ever stored in these structures.
 */

// ─── Roles & Permissions ────────────────────────────────────────────────────

export type Role =
  | "owner"
  | "security_lead"
  | "ops_lead"
  | "team_manager"
  | "analyst"
  | "operator"
  | "auditor";

/** Permission format: `<module>.<resource>.<verb>` */
export type Permission = string;

// ─── Classification ──────────────────────────────────────────────────────────

export type Classification = "public" | "internal" | "confidential" | "restricted";

// ─── Asset ───────────────────────────────────────────────────────────────────

export interface Asset {
  readonly asset_id: string;
  readonly asset_type: string;
  readonly module: "pc" | "flipper" | "openclaw";
  readonly owner_id: string;
  readonly classification: Classification;
  status: "active" | "inactive" | "archived";
  tags: readonly string[];
  readonly created_at: string; // ISO-8601
  updated_at: string;          // ISO-8601
}

// ─── Action envelope ─────────────────────────────────────────────────────────

export type ActionStatus =
  | "pending"
  | "approved"
  | "denied"
  | "executing"
  | "completed"
  | "failed";

export interface ActionEnvelope<TInput = unknown, TOutput = unknown> {
  readonly action_id: string;
  readonly actor_id: string;
  readonly domain: string;
  readonly input_payload: TInput;
  policy_decision: PolicyDecision | null;
  execution_ref: string | null;
  status: ActionStatus;
  output_payload: TOutput | null;
  readonly created_at: string;
  completed_at: string | null;
}

// ─── Policy ──────────────────────────────────────────────────────────────────

export type PolicyOutcome = "allow" | "deny" | "require_approval";

export interface PolicyDecision {
  readonly decision_id: string;
  readonly action_id: string;
  readonly outcome: PolicyOutcome;
  readonly reason: string;
  readonly evaluated_at: string;
  readonly evaluated_by: "policy_engine";
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditRecord {
  readonly audit_id: string;
  readonly action_id: string;
  readonly actor_id: string;
  readonly module: string;
  readonly event_type: string;
  readonly outcome: "success" | "failure" | "denied";
  readonly detail: Readonly<Record<string, unknown>>;
  readonly recorded_at: string;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export type WorkflowStatus =
  | "pending"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowStep {
  readonly step_id: string;
  readonly action: string;
  readonly input: Readonly<Record<string, unknown>>;
  status: WorkflowStatus;
  output: Readonly<Record<string, unknown>> | null;
}

export interface WorkflowRun {
  readonly run_id: string;
  readonly created_by: string;
  readonly module: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  readonly created_at: string;
  completed_at: string | null;
}
