import { CapabilityPermissionEngine, type AgentCapability, type PermissionDecision } from './security.js';
import { ProviderRouter } from './providers.js';

export interface AgentModelConfig {
  supervisor: string;
  context: string;
  code: string;
  safety: string;
}

export interface AgentTask {
  prompt: string;
  requestedCapabilities: AgentCapability[];
}

export interface AgentExecutionPlan {
  delegatedTo: Array<'context' | 'code' | 'safety'>;
  decisions: PermissionDecision[];
  synthesisModel: string;
}

export class AgentOrchestrator {
  constructor(
    private readonly permissions: CapabilityPermissionEngine,
    private readonly models: AgentModelConfig,
    private readonly providers: ProviderRouter
  ) {}

  buildPlan(task: AgentTask): AgentExecutionPlan {
    const decisions = task.requestedCapabilities.map((capability) =>
      this.permissions.evaluate({
        agentId: 'supervisor',
        capability,
        resource: 'workspace',
        requiresDoubleCheck: capability === 'write' || capability === 'exec' || capability === 'network'
      })
    );

    const delegatedTo: Array<'context' | 'code' | 'safety'> = ['context', 'code', 'safety'];

    return {
      delegatedTo,
      decisions,
      synthesisModel: this.models.supervisor
    };
  }

  async synthesize(prompt: string): Promise<string> {
    const routed = await this.providers.route({ model: this.models.supervisor, prompt });
    return routed.response.output;
  }

  getModelConfig(): AgentModelConfig {
    return { ...this.models };
  }
}
