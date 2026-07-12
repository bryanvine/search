import { NextRequest } from "next/server";
import { clientIp, createRateLimiter, isCrossOrigin } from "@/lib/guard";
import { streamVllmChat } from "@/lib/vllm";
import type { RankedResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SOURCES = 8;
const MAX_SNIPPET_CHARS = 600;
const MAX_QUERY_CHARS = 500;
const MAX_TITLE_CHARS = 200;
const MAX_URL_CHARS = 300;
const MAX_BODY_BYTES = 64 * 1024;

// The limit only has to keep the vLLM box from being farmed — the UI fires
// one request per search.
const rateLimited = createRateLimiter(20);

interface AnswerBody {
  query: string;
  results: Array<Pick<RankedResult, "url" | "title" | "content" | "domain">>;
}

function buildSystemPrompt(): string {
  return [
    "You are a careful research assistant grounded in the search results provided by the user.",
    "Rules:",
    "1. Only use facts that appear in the provided sources. If the sources don't answer the question, say so clearly.",
    "2. Cite every claim with bracketed numbers like [1], [2] — these correspond to the sources by number.",
    "3. You may cite multiple sources for one claim, e.g. [1][3].",
    "4. Be concise: 3–6 sentences for simple queries, longer only if the question explicitly demands it.",
    "5. Never invent URLs, dates, or quotes. Never speculate beyond the sources.",
    "6. If sources contradict, surface the disagreement and cite both sides.",
    "7. Write in clear, neutral prose. Do not use marketing language.",
  ].join("\n");
}

function buildUserPrompt(query: string, sources: AnswerBody["results"]): string {
  const lines: string[] = [];
  lines.push(`Question: ${query}`);
  lines.push("");
  lines.push("Sources:");
  sources.slice(0, MAX_SOURCES).forEach((s, i) => {
    const snippet = (s.content ?? "").slice(0, MAX_SNIPPET_CHARS).replace(/\s+/g, " ").trim();
    lines.push(`[${i + 1}] ${s.title} — ${s.domain}`);
    lines.push(`URL: ${s.url}`);
    if (snippet) lines.push(`Excerpt: ${snippet}`);
    lines.push("");
  });
  lines.push("Answer the question using only the sources above. Cite with [n].");
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  if (isCrossOrigin(req)) return new Response("forbidden", { status: 403 });
  if (rateLimited(clientIp(req))) return new Response("rate limited", { status: 429 });

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return new Response("payload too large", { status: 413 });
  }

  let body: AnswerBody;
  try {
    body = (await req.json()) as AnswerBody;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const query = (typeof body.query === "string" ? body.query : "").trim().slice(0, MAX_QUERY_CHARS);
  const results = (Array.isArray(body.results) ? body.results : [])
    .slice(0, MAX_SOURCES)
    .map((r) => ({
      url: String(r?.url ?? "").slice(0, MAX_URL_CHARS),
      title: String(r?.title ?? "").slice(0, MAX_TITLE_CHARS),
      content: String(r?.content ?? "").slice(0, MAX_SNIPPET_CHARS),
      domain: String(r?.domain ?? "").slice(0, 100),
    }));

  if (!query) return new Response("missing query", { status: 400 });
  if (!results.length) return new Response("missing results", { status: 400 });

  const messages = [
    { role: "system" as const, content: buildSystemPrompt() },
    { role: "user" as const, content: buildUserPrompt(query, results) },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const tok of streamVllmChat({
          messages,
          temperature: 0.2,
          maxTokens: 800,
          signal: req.signal,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: tok })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        // Log the real error server-side; the client gets a generic message
        // so backend details never leave the box.
        console.error("[answer] generation failed:", (err as Error).message);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "unavailable or timed out" })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
