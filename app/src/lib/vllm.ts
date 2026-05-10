/**
 * Thin OpenAI-compatible client for the self-hosted vLLM endpoint.
 *
 * No SDK dependency on purpose — we want a single fetch + ReadableStream
 * pipeline that's easy to inspect.
 */

const VLLM_BASE_URL = process.env.VLLM_BASE_URL ?? "http://mtkt-controller:8100/v1";
const VLLM_MODEL = process.env.VLLM_MODEL ?? "openai/gpt-oss-120b";

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
    signal: opts.signal,
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
