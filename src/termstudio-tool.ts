import { buildAgentSynthesis, buildAiPrompt, parseTerminalCommand } from './termstudio-core.js';

export interface TermStudioToolOptions {
  supervisorModel: string;
  specialistModel: string;
  agentMode: boolean;
  maxContextChars: number;
}

export interface ModelRequest {
  model: string;
  prompt: string;
  role: 'supervisor' | 'specialist';
}

export interface TermStudioToolAdapter {
  runModel(request: ModelRequest): Promise<string>;
  confirm?(message: string): boolean | Promise<boolean>;
  log?(message: string): void;
}

export interface AskResult {
  response: string;
  usedModels: string[];
}

export const defaultTermStudioToolOptions: TermStudioToolOptions = {
  supervisorModel: 'grok',
  specialistModel: 'qwen2.5:3b',
  agentMode: false,
  maxContextChars: 20_000
};

export class TermStudioTool {
  private readonly options: TermStudioToolOptions;
  private activeFilePath: string | null = null;
  private activeFileContent = '';

  constructor(
    private readonly adapter: TermStudioToolAdapter,
    options: Partial<TermStudioToolOptions> = {}
  ) {
    this.options = { ...defaultTermStudioToolOptions, ...options };
  }

  getConfig(): TermStudioToolOptions {
    return { ...this.options };
  }

  setActiveFile(path: string | null, content: string): void {
    this.activeFilePath = path;
    this.activeFileContent = content;
  }

  async ask(userPrompt: string): Promise<AskResult> {
    const trimmed = userPrompt.trim();
    if (!trimmed) return { response: '', usedModels: [] };

    const prompt = this.activeFilePath
      ? buildAiPrompt(trimmed, this.activeFilePath, this.activeFileContent.slice(0, this.options.maxContextChars))
      : buildAiPrompt(trimmed, null, '');

    const supervisor = await this.adapter.runModel({
      model: this.options.supervisorModel,
      prompt,
      role: 'supervisor'
    });

    if (!this.options.agentMode) {
      return { response: supervisor, usedModels: [this.options.supervisorModel] };
    }

    const specialist = await this.adapter.runModel({
      model: this.options.specialistModel,
      prompt: `Review and improve:\n${supervisor}`,
      role: 'specialist'
    });

    return {
      response: buildAgentSynthesis(supervisor, specialist),
      usedModels: [this.options.supervisorModel, this.options.specialistModel]
    };
  }

  async runCommand(raw: string): Promise<string> {
    const parsed = parseTerminalCommand(raw);
    if (parsed.type !== 'agent-review') {
      return `[terminal] Unknown command: ${raw}`;
    }

    if (!this.activeFilePath) return '[agent] No active file for review.';

    const target = parsed.target || this.activeFilePath;
    const approved = this.adapter.confirm ? await this.adapter.confirm(`Run agent review on ${target}?`) : true;
    if (!approved) return '[agent] Review cancelled by user.';

    const result = await this.ask(`Review this file and suggest safe improvements: ${target}`);
    this.adapter.log?.(`[agent] Review complete for ${target}`);
    return result.response;
  }
}

export function createTermStudioTool(
  adapter: TermStudioToolAdapter,
  options: Partial<TermStudioToolOptions> = {}
): TermStudioTool {
  return new TermStudioTool(adapter, options);
}
