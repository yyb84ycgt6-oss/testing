import crypto from "node:crypto";
import type { WorkflowRun, WorkflowStep, WorkflowStatus } from "./types.ts";
import { recordAudit } from "./audit.ts";

/**
 * Minimal workflow queue engine.
 * Steps execute sequentially; any failure halts the run.
 */

const MAX_WORKFLOW_STEPS = 50;

type StepHandler = (
  input: Readonly<Record<string, unknown>>
) => Promise<Readonly<Record<string, unknown>>>;

const _handlers = new Map<string, StepHandler>();
const _runs = new Map<string, WorkflowRun>();

export function registerHandler(action: string, handler: StepHandler): void {
  _handlers.set(action, handler);
}

export function createWorkflowRun(
  module: string,
  created_by: string,
  steps: Array<{ action: string; input: Readonly<Record<string, unknown>> }>
): WorkflowRun {
  if (steps.length === 0) {
    throw new Error("WorkflowRun must have at least one step.");
  }
  if (steps.length > MAX_WORKFLOW_STEPS) {
    throw new Error(`WorkflowRun exceeds maximum step count of ${MAX_WORKFLOW_STEPS}.`);
  }

  const run: WorkflowRun = {
    run_id: crypto.randomUUID(),
    created_by,
    module,
    steps: steps.map((s) => ({
      step_id: crypto.randomUUID(),
      action: s.action,
      input: Object.freeze({ ...s.input }),
      status: "pending",
      output: null,
    })),
    status: "pending",
    created_at: new Date().toISOString(),
    completed_at: null,
  };
  _runs.set(run.run_id, run);
  return run;
}

export async function executeWorkflowRun(run_id: string): Promise<WorkflowRun> {
  const run = _runs.get(run_id);
  if (!run) throw new Error(`WorkflowRun not found: ${run_id}`);

  run.status = "running";

  for (const step of run.steps) {
    const handler = _handlers.get(step.action);
    if (!handler) {
      step.status = "failed";
      run.status = "failed";
      recordAudit({
        action_id: run_id,
        actor_id: run.created_by,
        module: run.module,
        event_type: "workflow.step.failed",
        outcome: "failure",
        detail: { step_id: step.step_id, reason: `No handler for action: ${step.action}` },
      });
      run.completed_at = new Date().toISOString();
      return run;
    }

    step.status = "running" as WorkflowStatus;
    try {
      step.output = Object.freeze(await handler(step.input));
      step.status = "completed";
      recordAudit({
        action_id: run_id,
        actor_id: run.created_by,
        module: run.module,
        event_type: "workflow.step.completed",
        outcome: "success",
        detail: { step_id: step.step_id, action: step.action },
      });
    } catch (err) {
      step.status = "failed";
      run.status = "failed";
      recordAudit({
        action_id: run_id,
        actor_id: run.created_by,
        module: run.module,
        event_type: "workflow.step.failed",
        outcome: "failure",
        detail: {
          step_id: step.step_id,
          // Never log raw error messages that might contain secrets
          reason: err instanceof Error ? err.message : "Unknown error",
        },
      });
      run.completed_at = new Date().toISOString();
      return run;
    }
  }

  run.status = "completed";
  run.completed_at = new Date().toISOString();
  recordAudit({
    action_id: run_id,
    actor_id: run.created_by,
    module: run.module,
    event_type: "workflow.run.completed",
    outcome: "success",
    detail: { run_id, step_count: run.steps.length },
  });
  return run;
}

export function getWorkflowRun(run_id: string): WorkflowRun | undefined {
  return _runs.get(run_id);
}

/** For testing only. */
export function _clearWorkflowStore(): void {
  _runs.clear();
  _handlers.clear();
}
