import { GoogleGenAI } from "@google/genai";
import type { AIProvider, ChatRequest, ChatResponse } from "../../types.js";

export class GoogleProvider implements AIProvider {
  readonly name = "google";
  readonly defaultModel = "gemini-1.5-flash";

  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    this.client = new GoogleGenAI({
      apiKey: apiKey ?? process.env["GOOGLE_API_KEY"] ?? "",
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const model = this.client.models;
      await model.get({ model: this.defaultModel });
      return true;
    } catch {
      return false;
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const modelId = req.model ?? this.defaultModel;
    const systemMsg = req.messages.find((m) => m.role === "system")?.content;
    const history = req.messages
      .filter((m) => m.role !== "system")
      .slice(0, -1)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const lastMsg = req.messages.filter((m) => m.role !== "system").at(-1);

    const chat = this.client.chats.create({
      model: modelId,
      history,
      config: {
        systemInstruction: systemMsg,
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens,
      },
    });

    const response = await chat.sendMessage({ message: lastMsg?.content ?? "" });
    const content = response.text ?? "";

    return {
      content,
      model: modelId,
      provider: this.name,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }
}

export default GoogleProvider;
