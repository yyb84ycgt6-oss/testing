import { Mistral } from "@mistralai/mistralai";
import type { AIProvider, ChatRequest, ChatResponse } from "../../types.js";

export class MistralProvider implements AIProvider {
  readonly name = "mistral";
  readonly defaultModel = "mistral-small-latest";

  private client: Mistral;

  constructor(apiKey?: string) {
    this.client = new Mistral({ apiKey: apiKey ?? process.env["MISTRAL_API_KEY"] });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? this.defaultModel;
    const response = await this.client.chat.complete({
      model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: req.temperature ?? 0.7,
      maxTokens: req.maxTokens,
    });
    const choice = response.choices?.[0];
    const content =
      typeof choice?.message?.content === "string"
        ? choice.message.content
        : "";
    return {
      content,
      model,
      provider: this.name,
      usage: response.usage
        ? {
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            totalTokens: response.usage.totalTokens,
          }
        : undefined,
    };
  }
}

export default MistralProvider;
