export type ProviderMode = 'local' | 'cloud' | 'hybrid';

export interface ProviderHealth {
  healthy: boolean;
  latencyMs: number;
  detail?: string;
}

export interface ProviderRequest {
  model: string;
  prompt: string;
}

export interface ProviderResponse {
  providerId: string;
  output: string;
}

export interface ModelProviderAdapter {
  id: string;
  mode: ProviderMode;
  supportsModel(model: string): boolean;
  healthCheck(): Promise<ProviderHealth>;
  run(request: ProviderRequest): Promise<ProviderResponse>;
}

export interface RouteResult {
  response: ProviderResponse;
  attemptedProviders: string[];
}

export class ProviderRouter {
  constructor(private readonly adapters: ModelProviderAdapter[]) {}

  async route(request: ProviderRequest): Promise<RouteResult> {
    const supporting = this.adapters.filter((adapter) => adapter.supportsModel(request.model));
    if (supporting.length === 0) throw new Error(`No provider for model: ${request.model}`);

    const attempted: string[] = [];
    for (const adapter of supporting) {
      attempted.push(adapter.id);
      const health = await adapter.healthCheck();
      if (!health.healthy) continue;
      try {
        const response = await adapter.run(request);
        return { response, attemptedProviders: attempted };
      } catch {
        continue;
      }
    }

    throw new Error(`No healthy provider succeeded for model: ${request.model}`);
  }
}

export interface AdapterContractResult {
  adapterId: string;
  passed: boolean;
  details: string[];
}

export async function runAdapterContract(adapter: ModelProviderAdapter): Promise<AdapterContractResult> {
  const details: string[] = [];

  if (!adapter.id) details.push('Missing adapter id');
  if (!adapter.mode) details.push('Missing adapter mode');

  const health = await adapter.healthCheck();
  if (typeof health.healthy !== 'boolean') details.push('healthCheck.healthy must be boolean');
  if (typeof health.latencyMs !== 'number') details.push('healthCheck.latencyMs must be number');

  const supports = adapter.supportsModel('__contract_test__');
  if (typeof supports !== 'boolean') details.push('supportsModel must return boolean');

  return {
    adapterId: adapter.id,
    passed: details.length === 0,
    details
  };
}
