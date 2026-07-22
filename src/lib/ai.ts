import type OpenAI from 'openai';
import { env, optionalEnv } from './env';

// Lazy OpenAI client, mirroring src/lib/mailer.ts: the `openai` module is `import()`-ed on first
// use, NOT at module load — so routes that only transitively import this file don't pull the SDK
// into their cold-start init.
let client: OpenAI | null = null;

export async function openaiClient(): Promise<OpenAI> {
  if (!client) {
    const { default: OpenAI } = await import('openai');
    client = new OpenAI({ apiKey: env('OPENAI_API_KEY') });
  }
  return client;
}

/** The AI assistant ships dark until an API key is configured. */
export function aiEnabled(): boolean {
  return optionalEnv('OPENAI_API_KEY') !== undefined;
}

/** Model used for task-draft generation; overridable per environment. */
export function aiModel(): string {
  return env('AI_MODEL', 'gpt-4.1');
}
