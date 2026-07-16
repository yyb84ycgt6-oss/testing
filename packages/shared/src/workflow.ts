export type StepStatus = 'pending'|'approved'|'running'|'done'|'failed';
export interface WorkflowStep { id: string; action: string; status: StepStatus; }
export interface Workflow { id: string; steps: WorkflowStep[]; }
export function createWorkflow(actions: string[]): Workflow {
  return { id: crypto.randomUUID(), steps: actions.map(a=>({ id: crypto.randomUUID(), action: a, status: 'pending' })) };
}
