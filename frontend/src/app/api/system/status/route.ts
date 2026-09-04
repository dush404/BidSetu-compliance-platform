import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WorkerProbe {
  online: boolean;
  aiSource: string | null;
  version: string | null;
  provider: string | null;
  gemini: boolean;
  ollama: boolean;
  ollamaModel: string | null;
}

async function probeWorker(): Promise<WorkerProbe> {
  const candidateUrls = [
    process.env.AI_WORKER_URL,
    "http://localhost:8000",
    "http://localhost:3010",
  ].filter(Boolean) as string[];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        ai_source?: string;
        provider?: string;
        ollama_model?: string;
        version?: string | null;
      };
      const aiSource = data.ai_source ?? null;
      const provider =
        data.provider ??
        (aiSource?.toLowerCase().includes("ollama") ? "ollama" : "gemini");
      const isOllama = provider === "ollama" || /ollama/i.test(aiSource ?? "");
      const isGemini = provider === "gemini" || /gemini/i.test(aiSource ?? "");

      return {
        online: true,
        aiSource,
        version: data.version ?? null,
        provider,
        gemini: isGemini,
        ollama: isOllama,
        ollamaModel: data.ollama_model ?? "qwen3:14b",
      };
    } catch {
      continue;
    }
  }

  return {
    online: false,
    aiSource: null,
    version: null,
    provider: null,
    gemini: false,
    ollama: false,
    ollamaModel: null,
  };
}

/**
 * Platform status for the developer Settings console:
 * - SQLite database (standing in for Strapi until the real CMS connects)
 * - Python AI worker (FastAPI)
 */
export async function GET() {
  const [worker] = await Promise.all([probeWorker()]);

  let database: {
    online: boolean;
    mode: "adapter";
    label: string;
    latencyMs: number | null;
    error: string | null;
  } = {
    online: false,
    mode: "adapter",
    label: "SQLite",
    latencyMs: null,
    error: null,
  };

  try {
    const start = performance.now();
    await db.$queryRaw`SELECT 1`;
    const elapsed = Math.round(performance.now() - start);
    database = {
      online: true,
      mode: "adapter",
      label: "Strapi-compatible adapter · SQLite",
      latencyMs: elapsed,
      error: null,
    };
  } catch (err) {
    database = {
      online: false,
      mode: "adapter",
      label: "Strapi-compatible adapter · SQLite",
      latencyMs: null,
      error: err instanceof Error ? err.message : "DB unreachable",
    };
  }

  return NextResponse.json({
    aiWorker: worker,
    database,
    checkedAt: new Date().toISOString(),
  });
}

/**
 * Switch AI Provider endpoint (proxied to AI worker)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const candidateUrls = [
      process.env.AI_WORKER_URL,
      "http://localhost:8000",
      "http://localhost:3010",
    ].filter(Boolean) as string[];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(`${url}/switch-provider`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({ ok: true, health: data });
        }
      } catch {
        continue;
      }
    }
    return NextResponse.json(
      { error: "Could not contact AI worker to switch provider." },
      { status: 502 }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
