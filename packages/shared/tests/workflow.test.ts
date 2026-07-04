import { describe, it, expect, beforeEach } from "vitest";
import {
  createWorkflowRun,
  executeWorkflowRun,
  registerHandler,
  _clearWorkflowStore,
} from "../src/workflow.ts";
import { _clearAuditStore, getAuditRecords } from "../src/audit.ts";

describe("Workflow engine", () => {
  beforeEach(() => {
    _clearWorkflowStore();
    _clearAuditStore();
  });

  it("runs all steps and marks completed", async () => {
    registerHandler("test.step", async (input) => ({ result: "ok", echo: input["val"] }));
    const run = createWorkflowRun("pc", "u1", [
      { action: "test.step", input: { val: 42 } },
    ]);
    const finished = await executeWorkflowRun(run.run_id);
    expect(finished.status).toBe("completed");
    expect(finished.steps[0]?.output).toEqual({ result: "ok", echo: 42 });
  });

  it("fails run when handler throws", async () => {
    registerHandler("bad.step", async () => { throw new Error("intentional"); });
    const run = createWorkflowRun("flipper", "u1", [
      { action: "bad.step", input: {} },
    ]);
    const finished = await executeWorkflowRun(run.run_id);
    expect(finished.status).toBe("failed");
    expect(finished.steps[0]?.status).toBe("failed");
  });

  it("fails run when no handler registered", async () => {
    const run = createWorkflowRun("openclaw", "u1", [
      { action: "unregistered.action", input: {} },
    ]);
    const finished = await executeWorkflowRun(run.run_id);
    expect(finished.status).toBe("failed");
  });

  it("emits audit records for each step", async () => {
    registerHandler("audit.step", async () => ({}));
    const run = createWorkflowRun("pc", "u1", [
      { action: "audit.step", input: {} },
      { action: "audit.step", input: {} },
    ]);
    await executeWorkflowRun(run.run_id);
    const records = getAuditRecords({ module: "pc" });
    // 2 step.completed + 1 run.completed
    expect(records.length).toBeGreaterThanOrEqual(3);
  });

  it("throws for unknown run_id", async () => {
    await expect(executeWorkflowRun("nonexistent")).rejects.toThrow("not found");
  });

  it("rejects empty step array", () => {
    expect(() => createWorkflowRun("pc", "u1", [])).toThrow("at least one step");
  });

  it("rejects workflow exceeding max step count", () => {
    const steps = Array.from({ length: 51 }, (_, i) => ({ action: `step.${i}`, input: {} }));
    expect(() => createWorkflowRun("pc", "u1", steps)).toThrow("maximum step count");
  });

  it("stops executing remaining steps after a failure", async () => {
    registerHandler("ok.step", async () => ({ done: true }));
    registerHandler("fail.step", async () => { throw new Error("boom"); });
    const run = createWorkflowRun("pc", "u1", [
      { action: "fail.step", input: {} },
      { action: "ok.step", input: {} },
    ]);
    const finished = await executeWorkflowRun(run.run_id);
    expect(finished.status).toBe("failed");
    expect(finished.steps[0]!.status).toBe("failed");
    expect(finished.steps[1]!.status).toBe("pending");
  });

  it("audit records carry the correct created_by actor", async () => {
    registerHandler("actor.step", async () => ({}));
    const run = createWorkflowRun("pc", "actor-u99", [{ action: "actor.step", input: {} }]);
    await executeWorkflowRun(run.run_id);
    const records = getAuditRecords({ module: "pc" });
    expect(records.every((r) => r.actor_id === "actor-u99")).toBe(true);
  });

  it("step input is immutable", () => {
    const input = { val: 1 };
    const run = createWorkflowRun("pc", "u1", [{ action: "noop", input }]);
    expect(() => {
      // @ts-expect-error intentional mutation attempt
      run.steps[0]!.input.val = 99;
    }).toThrow();
  });
});
