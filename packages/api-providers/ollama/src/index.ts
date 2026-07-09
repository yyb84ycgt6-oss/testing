import { Ollama } from "ollama";
import type { AIProvider, ChatRequest, ChatResponse } from "../../types.js";

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  readonly defaultModel = "llama3";

  private client: Ollama;

  constructor(host = "http://localhost:11434") {
    this.client = new Ollama({ host });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? this.defaultModel;
    const response = await this.client.chat({
      model,
      messages: req.messages,
      options: {
        temperature: req.temperature ?? 0.7,
        num_predict: req.maxTokens,
      },
    });
    return {
      content: response.message.content,
      model,
      provider: this.name,
      usage: {
        promptTokens: response.prompt_eval_count ?? 0,
        completionTokens: response.eval_count ?? 0,
        totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
      },
    };
  }
}

export default OllamaProvider;
