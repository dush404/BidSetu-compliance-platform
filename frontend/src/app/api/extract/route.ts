import { NextRequest, NextResponse } from "next/server";
import { AI_WORKER_URL } from "@/lib/ai-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Proxies multipart document uploads to the AI worker's /extract endpoint
 * (Gemini vision extraction + quick compliance verification).
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a `file` field." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)." },
      { status: 413 }
    );
  }

  const upstream = new FormData();
  upstream.append("file", file, file.name);

  try {
    const res = await fetch(`${AI_WORKER_URL}/extract`, {
      method: "POST",
      body: upstream,
      signal: AbortSignal.timeout(110000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? `AI worker error (${res.status})` },
        { status: res.status === 503 ? 503 : 502 }
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "AI worker is unreachable. Is the ai-worker service running?" },
      { status: 502 }
    );
  }
}
