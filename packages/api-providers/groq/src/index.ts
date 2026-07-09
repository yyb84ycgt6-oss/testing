import Groq from "groq-sdk";
import type { AIProvider, ChatRequest, ChatResponse } from "../../types.js";

export class GroqProvider implements AIProvider {
  readonly name = "groq";
  readonly defaultModel = "llama3-8b-8192";

  private client: Groq;

  constructor(apiKey?: string) {
    this.client = new Groq({ apiKey: apiKey ?? process.env["GROQ_API_KEY"] });
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
    const completion = await this.client.chat.completions.create({
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens,
    });
    const choice = completion.choices[0];
    return {
      content: choice?.message?.content ?? "",
      model,
      provider: this.name,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  }
}

export default GroqProvider;
