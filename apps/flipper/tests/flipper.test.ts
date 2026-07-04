import { describe, it, expect, beforeEach } from "vitest";
import {
  registerFlipperDevice, listFlipperDevices,
  createProfile, listProfiles,
  addPayload,
  registerCloudTarget,
  pairBluetooth,
  createWifiProfile,
  queueSyncJob, listSyncJobs,
  _clearFlipperStore,
} from "../src/index.ts";
import { _clearAuditStore, getAuditRecords, generateActorId } from "@command-center/shared";

const ownerCtx = { actor_id: generateActorId(), roles: ["owner"] as const };
const analystCtx = { actor_id: generateActorId(), roles: ["analyst"] as const };

beforeEach(() => { _clearFlipperStore(); _clearAuditStore(); });

describe("Flipper – Device", () => {
  it("registers device and emits audit", () => {
    const d = registerFlipperDevice(ownerCtx, { serial_number: "FZ-001", firmware_version: "0.82.3" });
    expect(d.serial_number).toBe("FZ-001");
    expect(getAuditRecords({ module: "flipper" }).length).toBeGreaterThan(0);
  });

  it("requires serial number", () => {
    expect(() =>
      registerFlipperDevice(ownerCtx, { serial_number: "", firmware_version: "0.82.3" })
    ).toThrow("required");
  });

  it("analyst can list devices", () => {
    registerFlipperDevice(ownerCtx, { serial_number: "FZ-001", firmware_version: "0.82.3" });
    expect(listFlipperDevices(analystCtx)).toHaveLength(1);
  });

  it("analyst cannot register a flipper device", () => {
    expect(() =>
      registerFlipperDevice(analystCtx, { serial_number: "FZ-HACK", firmware_version: "0.82.3" })
    ).toThrow("Access denied");
  });
});

describe("Flipper – Profile (approval-gated)", () => {
  it("denied without approval", () => {
    const dev = registerFlipperDevice(ownerCtx, { serial_number: "FZ-001", firmware_version: "0.82.3" });
    expect(() =>
      createProfile(ownerCtx, { device_id: dev.asset_id, name: "Lab Profile" }, false)
    ).toThrow("denied");
  });

  it("created with approval", () => {
    const dev = registerFlipperDevice(ownerCtx, { serial_number: "FZ-001", firmware_version: "0.82.3" });
    const p = createProfile(ownerCtx, { device_id: dev.asset_id, name: "Lab Profile" }, true);
    expect(p.name).toBe("Lab Profile");
    expect(p.approved).toBe(true);
  });

  it("analyst can list profiles", () => {
    expect(listProfiles(analystCtx)).toHaveLength(0);
  });
});

describe("Flipper – Payload (approval-gated)", () => {
  it("denied without approval", () => {
    expect(() =>
      addPayload(ownerCtx, {
        profile_id: "p1", name: "BadUSB", payload_type: "badusb",
        checksum_sha256: "a".repeat(64),
      }, false)
    ).toThrow("denied");
  });

  it("rejects invalid checksum", () => {
    expect(() =>
      addPayload(ownerCtx, {
        profile_id: "p1", name: "x", payload_type: "y",
        checksum_sha256: "bad",
      }, true)
    ).toThrow("SHA-256");
  });
});

describe("Flipper – Bluetooth (privacy)", () => {
  it("denied without approval", () => {
    const dev = registerFlipperDevice(ownerCtx, { serial_number: "FZ-001", firmware_version: "0.82.3" });
    expect(() =>
      pairBluetooth(ownerCtx, { device_id: dev.asset_id, remote_name: "HeadsetX", remote_address: "AA:BB:CC:DD:EE:FF" }, false)
    ).toThrow("denied");
  });

  it("stores address hash not plaintext", () => {
    const dev = registerFlipperDevice(ownerCtx, { serial_number: "FZ-001", firmware_version: "0.82.3" });
    const pair = pairBluetooth(ownerCtx, {
      device_id: dev.asset_id, remote_name: "HeadsetX", remote_address: "AA:BB:CC:DD:EE:FF",
    }, true);
    expect(pair.remote_address_hash).toMatch(/^[a-f0-9]{64}$/);
    // Raw address must NOT appear anywhere in audit logs
    const logs = JSON.stringify(getAuditRecords({ module: "flipper" }));
    expect(logs).not.toContain("AA:BB:CC:DD:EE:FF");
  });
});

describe("Flipper – Wi-Fi (privacy)", () => {
  it("stores only password_set flag, never the password", () => {
    const profile = createWifiProfile(ownerCtx, { ssid: "LabNetwork", password: "s3cr3t!" }, true);
    expect(profile.password_set).toBe(true);
    // Password must not appear in the profile object or audit logs
    const logs = JSON.stringify(getAuditRecords({ module: "flipper" }));
    expect(logs).not.toContain("s3cr3t!");
    expect(JSON.stringify(profile)).not.toContain("s3cr3t!");
  });

  it("denied without approval", () => {
    expect(() =>
      createWifiProfile(ownerCtx, { ssid: "LabNetwork" }, false)
    ).toThrow("denied");
  });

  it("requires ssid", () => {
    expect(() =>
      createWifiProfile(ownerCtx, { ssid: "" }, true)
    ).toThrow("SSID required");
  });
});

describe("Flipper – Cloud / Sync", () => {
  it("cloud target denied without approval", () => {
    expect(() =>
      registerCloudTarget(ownerCtx, { provider: "gcs", bucket_ref: "my-bucket" }, false)
    ).toThrow("denied");
  });

  it("cloud target created with approval", () => {
    const t = registerCloudTarget(ownerCtx, { provider: "gcs", bucket_ref: "my-bucket" }, true);
    expect(t.provider).toBe("gcs");
  });

  it("sync job queued with approval", () => {
    const dev = registerFlipperDevice(ownerCtx, { serial_number: "FZ-001", firmware_version: "0.82.3" });
    const target = registerCloudTarget(ownerCtx, { provider: "gcs", bucket_ref: "b" }, true);
    const job = queueSyncJob(ownerCtx, { device_id: dev.asset_id, target_id: target.asset_id, direction: "upload" }, true);
    expect(job.direction).toBe("upload");
    expect(listSyncJobs(ownerCtx)).toHaveLength(1);
  });
});

describe("Flipper – Role boundaries", () => {
  it("auditor cannot list profiles", () => {
    const auditorCtx = { actor_id: generateActorId(), roles: ["auditor"] as const };
    expect(() => listProfiles(auditorCtx)).toThrow("Access denied");
  });

  it("auditor cannot list sync jobs", () => {
    const auditorCtx = { actor_id: generateActorId(), roles: ["auditor"] as const };
    expect(() => listSyncJobs(auditorCtx)).toThrow("Access denied");
  });

  it("analyst cannot create a wifi profile", () => {
    expect(() =>
      createWifiProfile(analystCtx, { ssid: "Net" }, true)
    ).toThrow("denied");
  });
});

describe("Flipper – Audit trail", () => {
  it("denied policy decision is recorded in audit log", () => {
    expect(() =>
      createProfile(ownerCtx, { device_id: "d1", name: "Denied" }, false)
    ).toThrow();
    const logs = getAuditRecords({ module: "flipper" });
    expect(logs.some((l) => l.outcome === "denied")).toBe(true);
  });

  it("bluetooth audit log never contains raw MAC address", () => {
    const dev = registerFlipperDevice(ownerCtx, { serial_number: "FZ-MAC", firmware_version: "0.82.3" });
    const mac = "DE:AD:BE:EF:00:11";
    pairBluetooth(ownerCtx, { device_id: dev.asset_id, remote_name: "Phone", remote_address: mac }, true);
    expect(JSON.stringify(getAuditRecords())).not.toContain(mac);
  });

  it("wifi audit log never contains password", () => {
    const secret = "ultra-secret-wifi-pw";
    createWifiProfile(ownerCtx, { ssid: "Corp", password: secret }, true);
    expect(JSON.stringify(getAuditRecords())).not.toContain(secret);
  });
});
