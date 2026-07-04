import crypto from "node:crypto";
import type { AuditRecord } from "./types.ts";

/**
 * Immutable in-memory audit log.
 * In production replace the store with an append-only database table.
 * Records are frozen on creation — no mutation is permitted.
 */

const _store: AuditRecord[] = [];

export function recordAudit(
  fields: Omit<AuditRecord, "audit_id" | "recorded_at">
): AuditRecord {
  const record: AuditRecord = Object.freeze({
    audit_id: crypto.randomUUID(),
    recorded_at: new Date().toISOString(),
    ...fields,
    // Freeze nested detail object to prevent mutation
    detail: Object.freeze({ ...fields.detail }),
  });
  _store.push(record);
  return record;
}

export function getAuditRecords(filter?: {
  actor_id?: string;
  module?: string;
  outcome?: AuditRecord["outcome"];
  since?: string; // ISO-8601
}): readonly AuditRecord[] {
  let results: readonly AuditRecord[] = _store;
  if (filter?.actor_id) {
    results = results.filter((r) => r.actor_id === filter.actor_id);
  }
  if (filter?.module) {
    results = results.filter((r) => r.module === filter.module);
  }
  if (filter?.outcome) {
    results = results.filter((r) => r.outcome === filter.outcome);
  }
  if (filter?.since) {
    results = results.filter((r) => r.recorded_at >= filter.since!);
  }
  return results;
}

/** For testing only — clears the in-memory store. */
export function _clearAuditStore(): void {
  _store.length = 0;
}
