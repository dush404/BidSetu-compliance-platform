import { NextResponse } from "next/server";
import { AI_WORKER_URL } from "@/lib/ai-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies the AI worker's /health so the UI can show live worker status
 * without the browser reaching the worker port directly.
 */
export async function GET() {
  try {
    const res = await fetch(`${AI_WORKER_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ online: true, ...data });
  } catch {
    return NextResponse.json(
      {
        online: false,
        status: "offline",
        ai_source: "AI worker unreachable",
        version: null,
      },
      { status: 200 }
    );
  }
}
