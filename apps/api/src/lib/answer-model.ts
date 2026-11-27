import Anthropic from '@anthropic-ai/sdk';

export interface AnswerRequest {
  system: string;
  prompt: string;
  signal: AbortSignal;
}

export interface AnswerModel {
  streamAnswer(request: AnswerRequest): AsyncIterable<string>;
}

class AnswerRefusedError extends Error {
  constructor() {
    super('The model declined to answer');
    this.name = 'AnswerRefusedError';
  }
}

export const DEFAULT_ASK_MODEL = 'claude-haiku-5-5';

export const DEFAULT_ASK_MAX_TOKENS = 400;

interface AnthropicAnswerModelOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  baseURL?: string | undefined;
}

export function anthropicAnswerModel({
  apiKey,
  model,
  maxTokens,
  baseURL,
}: AnthropicAnswerModelOptions): AnswerModel {
  const client = new Anthropic({ apiKey, ...(baseURL && { baseURL }) });
  return {
    async *streamAnswer({ system, prompt, signal }) {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: maxTokens,
          thinking: { type: 'disabled' },
          system,
          messages: [{ role: 'user', content: prompt }],
        },
        { signal },
      );
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
      if ((await stream.finalMessage()).stop_reason === 'refusal') throw new AnswerRefusedError();
    },
  };
}
