import OpenAI from "openai";
import type { AIProvider, ChatRequest, ChatResponse } from "../../types.js";

// OpenRouter is OpenAI-compatible — uses openai SDK pointed at openrouter.ai
export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";
  readonly defaultModel = "mistralai/mistral-7b-instruct:free";

  private client: OpenAI;

  constructor(apiKey?: string, siteUrl?: string, siteName?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env["OPENROUTER_API_KEY"],
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": siteUrl ?? process.env["OPENROUTER_SITE_URL"] ?? "",
        "X-Title": siteName ?? process.env["OPENROUTER_SITE_NAME"] ?? "google-api",
      },
    });
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

export default OpenRouterProvider;
