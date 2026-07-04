import crypto from "node:crypto";
import type { Asset } from "@command-center/shared";
import {
  assertAccess,
  evaluatePolicy,
  recordAudit,
  type AccessContext,
} from "@command-center/shared";

// ─── Entity types ─────────────────────────────────────────────────────────────

export interface PCDevice extends Asset {
  readonly asset_type: "pc_device";
  readonly module: "pc";
  hostname: string;
  ip_address: string; // never logged in plaintext
  os: string;
  last_seen: string;
}

export interface PCSession extends Asset {
  readonly asset_type: "pc_session";
  readonly module: "pc";
  readonly device_id: string;
  started_at: string;
  ended_at: string | null;
  session_type: "interactive" | "remote" | "service";
}

export interface PCFileAsset extends Asset {
  readonly asset_type: "pc_file_asset";
  readonly module: "pc";
  readonly device_id: string;
  path: string;
  size_bytes: number;
  checksum_sha256: string;
}

export interface PCToolProfile extends Asset {
  readonly asset_type: "pc_tool_profile";
  readonly module: "pc";
  name: string;
  version: string;
  launch_command: string;
}

// ─── In-memory stores (replace with DB in production) ────────────────────────

const _devices = new Map<string, PCDevice>();
const _sessions = new Map<string, PCSession>();
const _files = new Map<string, PCFileAsset>();
const _tools = new Map<string, PCToolProfile>();

// ─── Input validation ─────────────────────────────────────────────────────────

function validateHostname(h: string): void {
  if (!h || h.length > 253 || !/^[a-zA-Z0-9._-]+$/.test(h)) {
    throw new Error("Invalid hostname.");
  }
}

function validatePath(p: string): void {
  if (!p || p.includes("..") || p.length > 4096) {
    throw new Error("Invalid file path.");
  }
}

// ─── PC Module API ────────────────────────────────────────────────────────────

export function registerDevice(
  ctx: AccessContext,
  input: { hostname: string; os: string; ip_address: string }
): PCDevice {
  assertAccess(ctx, "pc.device.write");
  validateHostname(input.hostname);
  if (!input.os) throw new Error("OS is required.");

  const now = new Date().toISOString();
  const device: PCDevice = {
    asset_id: crypto.randomUUID(),
    asset_type: "pc_device",
    module: "pc",
    owner_id: ctx.actor_id,
    classification: "internal",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    hostname: input.hostname,
    ip_address: input.ip_address, // stored but never logged
    os: input.os,
    last_seen: now,
  };
  _devices.set(device.asset_id, device);

  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "pc",
    event_type: "pc.device.registered",
    outcome: "success",
    // ip_address intentionally omitted from audit detail
    detail: { asset_id: device.asset_id, hostname: device.hostname },
  });
  return device;
}

export function listDevices(ctx: AccessContext): readonly PCDevice[] {
  assertAccess(ctx, "pc.device.read");
  return Array.from(_devices.values()).filter((d) => d.status !== "archived");
}

export function getDevice(ctx: AccessContext, device_id: string): PCDevice {
  assertAccess(ctx, "pc.device.read");
  const d = _devices.get(device_id);
  if (!d) throw new Error(`Device not found: ${device_id}`);
  return d;
}

export function startSession(
  ctx: AccessContext,
  input: { device_id: string; session_type: PCSession["session_type"] }
): PCSession {
  // Remote/interactive session execution is high-risk — check policy
  const decision = evaluatePolicy({
    action_id: crypto.randomUUID(),
    permission: "pc.session.execute",
    ctx,
  });

  recordAudit({
    action_id: decision.action_id,
    actor_id: ctx.actor_id,
    module: "pc",
    event_type: "policy.decision.recorded",
    outcome: decision.outcome === "allow" ? "success" : "denied",
    detail: { permission: "pc.session.execute", outcome: decision.outcome },
  });

  if (decision.outcome !== "allow") {
    throw new Error(`Session start denied: ${decision.reason}`);
  }

  const device = getDevice(ctx, input.device_id);
  const now = new Date().toISOString();
  const session: PCSession = {
    asset_id: crypto.randomUUID(),
    asset_type: "pc_session",
    module: "pc",
    owner_id: ctx.actor_id,
    classification: "confidential",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    device_id: device.asset_id,
    started_at: now,
    ended_at: null,
    session_type: input.session_type,
  };
  _sessions.set(session.asset_id, session);

  recordAudit({
    action_id: decision.action_id,
    actor_id: ctx.actor_id,
    module: "pc",
    event_type: "pc.session.started",
    outcome: "success",
    detail: { session_id: session.asset_id, device_id: device.asset_id },
  });
  return session;
}

export function endSession(ctx: AccessContext, session_id: string): PCSession {
  assertAccess(ctx, "pc.session.read");
  const session = _sessions.get(session_id);
  if (!session) throw new Error(`Session not found: ${session_id}`);
  session.ended_at = new Date().toISOString();
  session.status = "inactive";
  session.updated_at = session.ended_at;
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "pc",
    event_type: "pc.session.ended",
    outcome: "success",
    detail: { session_id },
  });
  return session;
}

export function listSessions(ctx: AccessContext): readonly PCSession[] {
  assertAccess(ctx, "pc.session.read");
  return Array.from(_sessions.values());
}

export function registerFile(
  ctx: AccessContext,
  input: { device_id: string; path: string; size_bytes: number; checksum_sha256: string }
): PCFileAsset {
  assertAccess(ctx, "pc.device.read");
  validatePath(input.path);
  if (!/^[a-f0-9]{64}$/.test(input.checksum_sha256)) {
    throw new Error("Invalid SHA-256 checksum.");
  }

  const now = new Date().toISOString();
  const file: PCFileAsset = {
    asset_id: crypto.randomUUID(),
    asset_type: "pc_file_asset",
    module: "pc",
    owner_id: ctx.actor_id,
    classification: "internal",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    device_id: input.device_id,
    path: input.path,
    size_bytes: input.size_bytes,
    checksum_sha256: input.checksum_sha256,
  };
  _files.set(file.asset_id, file);
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "pc",
    event_type: "pc.file.registered",
    outcome: "success",
    detail: { asset_id: file.asset_id, path: file.path },
  });
  return file;
}

export function listFiles(ctx: AccessContext, device_id?: string): readonly PCFileAsset[] {
  assertAccess(ctx, "pc.file.read");
  const all = Array.from(_files.values());
  return device_id ? all.filter((f) => f.device_id === device_id) : all;
}

export function registerTool(
  ctx: AccessContext,
  input: { name: string; version: string; launch_command: string }
): PCToolProfile {
  assertAccess(ctx, "pc.device.write");
  if (!input.name || !input.version) throw new Error("Tool name and version are required.");

  const now = new Date().toISOString();
  const tool: PCToolProfile = {
    asset_id: crypto.randomUUID(),
    asset_type: "pc_tool_profile",
    module: "pc",
    owner_id: ctx.actor_id,
    classification: "internal",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    name: input.name,
    version: input.version,
    launch_command: input.launch_command,
  };
  _tools.set(tool.asset_id, tool);
  return tool;
}

export function listTools(ctx: AccessContext): readonly PCToolProfile[] {
  assertAccess(ctx, "pc.device.read");
  return Array.from(_tools.values()).filter((t) => t.status === "active");
}

/** For testing only. */
export function _clearPCStore(): void {
  _devices.clear();
  _sessions.clear();
  _files.clear();
  _tools.clear();
}
