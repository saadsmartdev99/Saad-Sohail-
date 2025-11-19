export interface AiResponse {
  answer: string;
  tokenCount: number;
  latencyMs: number;
}

export class AiResponseSimulator {
  async generateResponse(question: string): Promise<AiResponse> {
    const latencyMs = 300 + Math.floor(Math.random() * 901); // 300-1200ms
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    const answer = `Mocked AI answer: ${question}`;
    const words = question.trim().length === 0 ? 0 : question.trim().split(/\s+/).length;
    const tokenCount = words * 3;

    return { answer, tokenCount, latencyMs };
  }
}
