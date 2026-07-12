/**
 * Thin OpenAI-compatible client for the self-hosted vLLM endpoint.
 *
 * No SDK dependency on purpose — we want a single fetch + ReadableStream
 * pipeline that's easy to inspect.
 */

// Set VLLM_BASE_URL and VLLM_MODEL in your .env. The endpoint must be
// OpenAI-compatible (vLLM, llama.cpp server, Ollama with --openai-compat,
// LMStudio, etc.). VLLM_MODEL is the model name your endpoint serves.
const VLLM_BASE_URL = process.env.VLLM_BASE_URL ?? "http://localhost:8100/v1";
const VLLM_MODEL = process.env.VLLM_MODEL ?? "your-model";

// Overall cap on connect + full stream. Generous — an ~800-token answer
// finishes well inside this — but a hung backend can't pin the request open.
const STREAM_TIMEOUT_MS = 120_000;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface VllmChatStreamOpts {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface ChatChoiceDelta {
  content?: string;
  role?: string;
}

interface ChatStreamChunk {
  choices?: Array<{ delta?: ChatChoiceDelta; finish_reason?: string | null }>;
}

/**
 * Stream tokens from vLLM as an async iterator of strings.
 *
 * Parses OpenAI-format SSE: "data: {...json...}\n\n" with a "data: [DONE]"
 * sentinel.
 */
export async function* streamVllmChat(opts: VllmChatStreamOpts): AsyncGenerator<string> {
  const signals = [AbortSignal.timeout(STREAM_TIMEOUT_MS)];
  if (opts.signal) signals.push(opts.signal);

  const res = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      model: VLLM_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true,
    }),
    signal: AbortSignal.any(signals),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`vLLM ${res.status}: ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // Process complete lines
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const raw = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!raw) continue;
      if (!raw.startsWith("data:")) continue;
      const data = raw.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const chunk = JSON.parse(data) as ChatStreamChunk;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Tolerate stray non-JSON lines (keepalives etc.)
      }
    }
  }
}
