import type { AIProvider, ChatRequest, ChatResponse } from "./types.js";

/**
 * Intelligent fallback router — tries providers in order until one succeeds.
 * Priority: Ollama (local) → Groq (free/fast) → Mistral (free) →
 *           OpenRouter (free tier) → Google → Anthropic
 */
export class ProviderRouter implements AIProvider {
  readonly name = "router";
  readonly defaultModel = "";

  constructor(private readonly providers: AIProvider[]) {
    if (providers.length === 0) throw new Error("ProviderRouter: no providers supplied");
  }

  async isAvailable(): Promise<boolean> {
    for (const p of this.providers) {
      if (await p.isAvailable()) return true;
    }
    return false;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const errors: string[] = [];
    for (const p of this.providers) {
      try {
        if (await p.isAvailable()) return await p.chat(req);
      } catch (err) {
        errors.push(`${p.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error(`All providers failed:\n${errors.join("\n")}`);
  }
}

export { type AIProvider, type ChatRequest, type ChatResponse } from "./types.js";
