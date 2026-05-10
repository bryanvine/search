import { NextRequest } from "next/server";
import { streamVllmChat } from "@/lib/vllm";
import type { RankedResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SOURCES = 8;
const MAX_SNIPPET_CHARS = 600;

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
  let body: AnswerBody;
  try {
    body = (await req.json()) as AnswerBody;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const query = (body.query ?? "").trim();
  const results = Array.isArray(body.results) ? body.results : [];

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
        const msg = (err as Error).message ?? "vllm error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
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
