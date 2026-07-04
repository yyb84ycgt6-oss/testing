export interface LocalModelProfile {
  id: string;
  displayName: string;
  provider: 'ollama-local';
  enabledByDefault: boolean;
  compatibility: {
    ollamaNative: boolean;
    requiresConversion: boolean;
    notes: string;
  };
}

const MODELS: Record<string, LocalModelProfile> = {
  llama: {
    id: 'llama',
    displayName: 'Llama',
    provider: 'ollama-local',
    enabledByDefault: true,
    compatibility: {
      ollamaNative: true,
      requiresConversion: false,
      notes: 'Native/local profile'
    }
  },
  qwen: {
    id: 'qwen',
    displayName: 'Qwen',
    provider: 'ollama-local',
    enabledByDefault: true,
    compatibility: {
      ollamaNative: true,
      requiresConversion: false,
      notes: 'Native/local profile'
    }
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek',
    provider: 'ollama-local',
    enabledByDefault: true,
    compatibility: {
      ollamaNative: true,
      requiresConversion: false,
      notes: 'Native/local profile'
    }
  },
  openclaw: {
    id: 'openclaw',
    displayName: 'OpenClaw',
    provider: 'ollama-local',
    enabledByDefault: false,
    compatibility: {
      ollamaNative: false,
      requiresConversion: true,
      notes: 'Use only if a compatible GGUF/local build exists and passes validation.'
    }
  },
  whiterabbit: {
    id: 'whiterabbit',
    displayName: 'WhiteRabbit',
    provider: 'ollama-local',
    enabledByDefault: false,
    compatibility: {
      ollamaNative: false,
      requiresConversion: true,
      notes: 'No guaranteed native Ollama support; require vetted local build + guardrails.'
    }
  }
};

export function getModelRegistry(): LocalModelProfile[] {
  return Object.values(MODELS);
}

export function validateModelSelection(modelId: string): LocalModelProfile {
  const normalized = modelId.trim().toLowerCase();
  const model = MODELS[normalized];
  if (!model) {
    throw new Error(`Model '${modelId}' is not allowed`);
  }
  return model;
}
