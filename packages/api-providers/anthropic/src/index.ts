import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, ChatRequest, ChatResponse } from "../../types.js";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly defaultModel = "claude-3-haiku-20240307";

  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env["ANTHROPIC_API_KEY"] });
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
    const systemMsg = req.messages.find((m) => m.role === "system");
    const userMessages = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const response = await this.client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 1024,
      system: systemMsg?.content,
      messages: userMessages,
    });

    const content =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return {
      content,
      model,
      provider: this.name,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}

export default AnthropicProvider;
