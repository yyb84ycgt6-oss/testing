import { createHmac } from 'node:crypto';

export type PluginPermission = 'read' | 'write' | 'exec' | 'network';

export interface PluginManifest {
  id: string;
  version: string;
  permissionSchemaVersion: 1;
  permissions: PluginPermission[];
  quotas: {
    maxMemoryMb: number;
    maxCpuMsPerMinute: number;
  };
}

export interface PluginRuntimeState {
  enabled: boolean;
  memoryMbUsed: number;
  cpuMsUsedCurrentMinute: number;
}

function canonicalManifest(manifest: PluginManifest): string {
  return JSON.stringify({
    id: manifest.id,
    version: manifest.version,
    permissionSchemaVersion: manifest.permissionSchemaVersion,
    permissions: [...manifest.permissions].sort(),
    quotas: manifest.quotas
  });
}

export function signManifest(manifest: PluginManifest, secret: string): string {
  return createHmac('sha256', secret).update(canonicalManifest(manifest)).digest('hex');
}

export class PluginSecurityManager {
  private readonly states = new Map<string, PluginRuntimeState>();

  verifyManifest(manifest: PluginManifest, signature: string, secret: string): boolean {
    if (manifest.permissionSchemaVersion !== 1) return false;
    const expected = signManifest(manifest, secret);
    return expected === signature;
  }

  register(manifest: PluginManifest): void {
    this.states.set(manifest.id, {
      enabled: true,
      memoryMbUsed: 0,
      cpuMsUsedCurrentMinute: 0
    });
  }

  killSwitch(pluginId: string): void {
    const state = this.states.get(pluginId);
    if (!state) throw new Error(`Plugin not registered: ${pluginId}`);
    state.enabled = false;
  }

  consumeQuota(pluginId: string, manifest: PluginManifest, usage: { memoryMb: number; cpuMs: number }): void {
    const state = this.states.get(pluginId);
    if (!state) throw new Error(`Plugin not registered: ${pluginId}`);
    if (!state.enabled) throw new Error(`Plugin disabled: ${pluginId}`);

    state.memoryMbUsed += usage.memoryMb;
    state.cpuMsUsedCurrentMinute += usage.cpuMs;

    if (state.memoryMbUsed > manifest.quotas.maxMemoryMb) {
      state.enabled = false;
      throw new Error(`Plugin ${pluginId} exceeded memory quota`);
    }

    if (state.cpuMsUsedCurrentMinute > manifest.quotas.maxCpuMsPerMinute) {
      state.enabled = false;
      throw new Error(`Plugin ${pluginId} exceeded CPU quota`);
    }
  }

  readState(pluginId: string): PluginRuntimeState {
    const state = this.states.get(pluginId);
    if (!state) throw new Error(`Plugin not registered: ${pluginId}`);
    return { ...state };
  }
}
