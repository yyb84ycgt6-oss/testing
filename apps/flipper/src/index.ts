import crypto from "node:crypto";
import type { Asset } from "@command-center/shared";
import {
  assertAccess,
  evaluatePolicy,
  recordAudit,
  type AccessContext,
} from "@command-center/shared";

// ─── Entity types ─────────────────────────────────────────────────────────────

export interface FlipperDevice extends Asset {
  readonly asset_type: "flipper_device";
  readonly module: "flipper";
  serial_number: string;
  firmware_version: string;
  last_seen: string;
}

export interface FlipperProfile extends Asset {
  readonly asset_type: "flipper_profile";
  readonly module: "flipper";
  readonly device_id: string;
  name: string;
  version: number;
  approved: boolean;
}

export interface FlipperPayload extends Asset {
  readonly asset_type: "flipper_payload";
  readonly module: "flipper";
  readonly profile_id: string;
  name: string;
  payload_type: string;
  checksum_sha256: string;
  approved: boolean;
}

export interface FlipperCloudTarget extends Asset {
  readonly asset_type: "flipper_cloud_target";
  readonly module: "flipper";
  provider: string;
  /** Bucket/path reference — no credentials stored here */
  bucket_ref: string;
  approved: boolean;
}

export interface FlipperBluetoothPair extends Asset {
  readonly asset_type: "flipper_bluetooth_pair";
  readonly module: "flipper";
  readonly device_id: string;
  remote_name: string;
  remote_address_hash: string; // SHA-256 of address — raw address never stored
  trusted: boolean;
}

export interface FlipperWifiProfile extends Asset {
  readonly asset_type: "flipper_wifi_profile";
  readonly module: "flipper";
  ssid: string;
  /** Password is NEVER stored — only a flag that one is set */
  password_set: boolean;
  approved: boolean;
}

export interface FlipperSyncJob extends Asset {
  readonly asset_type: "flipper_sync_job";
  readonly module: "flipper";
  readonly device_id: string;
  readonly target_id: string;
  direction: "upload" | "download";
  status: "queued" | "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
}

// ─── Stores ───────────────────────────────────────────────────────────────────

const _devices = new Map<string, FlipperDevice>();
const _profiles = new Map<string, FlipperProfile>();
const _payloads = new Map<string, FlipperPayload>();
const _cloudTargets = new Map<string, FlipperCloudTarget>();
const _btPairs = new Map<string, FlipperBluetoothPair>();
const _wifiProfiles = new Map<string, FlipperWifiProfile>();
const _syncJobs = new Map<string, FlipperSyncJob>();

// ─── Validation ───────────────────────────────────────────────────────────────

function validateChecksum(c: string): void {
  if (!/^[a-f0-9]{64}$/.test(c)) throw new Error("Invalid SHA-256 checksum.");
}

function requireApprovalGate(ctx: AccessContext, permission: string, approved: boolean): void {
  const decision = evaluatePolicy({ action_id: crypto.randomUUID(), permission, ctx, approved });
  recordAudit({
    action_id: decision.action_id,
    actor_id: ctx.actor_id,
    module: "flipper",
    event_type: "policy.decision.recorded",
    outcome: decision.outcome === "allow" ? "success" : "denied",
    detail: { permission, outcome: decision.outcome },
  });
  if (decision.outcome !== "allow") {
    throw new Error(`Action denied: ${decision.reason}`);
  }
}

// ─── Device ───────────────────────────────────────────────────────────────────

export function registerFlipperDevice(
  ctx: AccessContext,
  input: { serial_number: string; firmware_version: string }
): FlipperDevice {
  assertAccess(ctx, "flipper.device.write");
  if (!input.serial_number || !input.firmware_version) {
    throw new Error("Serial number and firmware version are required.");
  }
  const now = new Date().toISOString();
  const device: FlipperDevice = {
    asset_id: crypto.randomUUID(),
    asset_type: "flipper_device",
    module: "flipper",
    owner_id: ctx.actor_id,
    classification: "internal",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    serial_number: input.serial_number,
    firmware_version: input.firmware_version,
    last_seen: now,
  };
  _devices.set(device.asset_id, device);
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "flipper",
    event_type: "flipper.device.registered",
    outcome: "success",
    detail: { asset_id: device.asset_id },
  });
  return device;
}

export function listFlipperDevices(ctx: AccessContext): readonly FlipperDevice[] {
  assertAccess(ctx, "flipper.device.read");
  return Array.from(_devices.values()).filter((d) => d.status !== "archived");
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function createProfile(
  ctx: AccessContext,
  input: { device_id: string; name: string },
  approved = false
): FlipperProfile {
  requireApprovalGate(ctx, "flipper.profile.write", approved);
  const now = new Date().toISOString();
  const profile: FlipperProfile = {
    asset_id: crypto.randomUUID(),
    asset_type: "flipper_profile",
    module: "flipper",
    owner_id: ctx.actor_id,
    classification: "confidential",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    device_id: input.device_id,
    name: input.name,
    version: 1,
    approved,
  };
  _profiles.set(profile.asset_id, profile);
  return profile;
}

export function listProfiles(ctx: AccessContext, device_id?: string): readonly FlipperProfile[] {
  assertAccess(ctx, "flipper.profile.read");
  const all = Array.from(_profiles.values());
  return device_id ? all.filter((p) => p.device_id === device_id) : all;
}

// ─── Payload ──────────────────────────────────────────────────────────────────

export function addPayload(
  ctx: AccessContext,
  input: { profile_id: string; name: string; payload_type: string; checksum_sha256: string },
  approved = false
): FlipperPayload {
  requireApprovalGate(ctx, "flipper.payload.approve", approved);
  validateChecksum(input.checksum_sha256);
  const now = new Date().toISOString();
  const payload: FlipperPayload = {
    asset_id: crypto.randomUUID(),
    asset_type: "flipper_payload",
    module: "flipper",
    owner_id: ctx.actor_id,
    classification: "restricted",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    profile_id: input.profile_id,
    name: input.name,
    payload_type: input.payload_type,
    checksum_sha256: input.checksum_sha256,
    approved,
  };
  _payloads.set(payload.asset_id, payload);
  return payload;
}

// ─── Cloud target ─────────────────────────────────────────────────────────────

export function registerCloudTarget(
  ctx: AccessContext,
  input: { provider: string; bucket_ref: string },
  approved = false
): FlipperCloudTarget {
  requireApprovalGate(ctx, "flipper.cloud.sync", approved);
  if (!input.provider || !input.bucket_ref) throw new Error("Provider and bucket_ref required.");
  const now = new Date().toISOString();
  const target: FlipperCloudTarget = {
    asset_id: crypto.randomUUID(),
    asset_type: "flipper_cloud_target",
    module: "flipper",
    owner_id: ctx.actor_id,
    classification: "confidential",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    provider: input.provider,
    bucket_ref: input.bucket_ref,
    approved,
  };
  _cloudTargets.set(target.asset_id, target);
  return target;
}

// ─── Bluetooth pairing ────────────────────────────────────────────────────────

export function pairBluetooth(
  ctx: AccessContext,
  input: { device_id: string; remote_name: string; remote_address: string },
  approved = false
): FlipperBluetoothPair {
  requireApprovalGate(ctx, "flipper.bluetooth.pair", approved);
  // Hash the raw BT address — never store it in plaintext
  const remote_address_hash = crypto
    .createHash("sha256")
    .update(input.remote_address)
    .digest("hex");

  const now = new Date().toISOString();
  const pair: FlipperBluetoothPair = {
    asset_id: crypto.randomUUID(),
    asset_type: "flipper_bluetooth_pair",
    module: "flipper",
    owner_id: ctx.actor_id,
    classification: "confidential",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    device_id: input.device_id,
    remote_name: input.remote_name,
    remote_address_hash,
    trusted: false,
  };
  _btPairs.set(pair.asset_id, pair);
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "flipper",
    event_type: "flipper.bluetooth.paired",
    outcome: "success",
    // raw address never logged
    detail: { asset_id: pair.asset_id, remote_name: pair.remote_name },
  });
  return pair;
}

// ─── Wi-Fi profile ────────────────────────────────────────────────────────────

export function createWifiProfile(
  ctx: AccessContext,
  input: { ssid: string; password?: string },
  approved = false
): FlipperWifiProfile {
  requireApprovalGate(ctx, "flipper.wifi.connect", approved);
  if (!input.ssid) throw new Error("SSID required.");

  const now = new Date().toISOString();
  const profile: FlipperWifiProfile = {
    asset_id: crypto.randomUUID(),
    asset_type: "flipper_wifi_profile",
    module: "flipper",
    owner_id: ctx.actor_id,
    classification: "confidential",
    status: "active",
    tags: [],
    created_at: now,
    updated_at: now,
    ssid: input.ssid,
    password_set: Boolean(input.password), // password itself is never stored
    approved,
  };
  _wifiProfiles.set(profile.asset_id, profile);
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "flipper",
    event_type: "flipper.wifi.profile.created",
    outcome: "success",
    // ssid logged, password never logged
    detail: { asset_id: profile.asset_id, ssid: profile.ssid },
  });
  return profile;
}

// ─── Sync job ─────────────────────────────────────────────────────────────────

export function queueSyncJob(
  ctx: AccessContext,
  input: { device_id: string; target_id: string; direction: FlipperSyncJob["direction"] },
  approved = false
): FlipperSyncJob {
  requireApprovalGate(ctx, "flipper.cloud.sync", approved);
  const now = new Date().toISOString();
  const job: FlipperSyncJob = {
    asset_id: crypto.randomUUID(),
    asset_type: "flipper_sync_job",
    module: "flipper",
    owner_id: ctx.actor_id,
    classification: "internal",
    tags: [],
    created_at: now,
    updated_at: now,
    device_id: input.device_id,
    target_id: input.target_id,
    direction: input.direction,
    status: "queued",
    started_at: null,
    completed_at: null,
  };
  _syncJobs.set(job.asset_id, job);
  recordAudit({
    action_id: crypto.randomUUID(),
    actor_id: ctx.actor_id,
    module: "flipper",
    event_type: "flipper.sync.queued",
    outcome: "success",
    detail: { job_id: job.asset_id, direction: job.direction },
  });
  return job;
}

export function listSyncJobs(ctx: AccessContext, device_id?: string): readonly FlipperSyncJob[] {
  assertAccess(ctx, "flipper.sync.read");
  const all = Array.from(_syncJobs.values());
  return device_id ? all.filter((j) => j.device_id === device_id) : all;
}

/** For testing only. */
export function _clearFlipperStore(): void {
  _devices.clear();
  _profiles.clear();
  _payloads.clear();
  _cloudTargets.clear();
  _btPairs.clear();
  _wifiProfiles.clear();
  _syncJobs.clear();
}
