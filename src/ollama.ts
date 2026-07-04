export class OllamaClient {
  constructor(private readonly endpoint: string = 'http://127.0.0.1:11434') {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:') throw new Error('Only http localhost endpoints are supported for local mode');
    if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
      throw new Error('Ollama endpoint must be localhost only');
    }
  }

  async healthCheck(): Promise<{ ok: true; endpoint: string }> {
    const response = await fetch(`${this.endpoint}/api/tags`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`Ollama health check failed with ${response.status}`);
    }
    return { ok: true, endpoint: this.endpoint };
  }
}
