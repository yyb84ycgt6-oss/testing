export interface AuditRecord { id: string; actor: string; action: string; outcome: string; ts: number; }
const log: AuditRecord[] = [];
export function record(actor: string, action: string, outcome: string): AuditRecord {
  const entry: AuditRecord = { id: crypto.randomUUID(), actor, action, outcome, ts: Date.now() };
  log.push(entry);
  return entry;
}
export function readLog(): readonly AuditRecord[] { return log; }
