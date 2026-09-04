import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Test a government database connector endpoint.
 * Body: { connector: string, url: string, token?: string }
 * Returns: { ok: boolean, latencyMs: number, statusCode?: number, error?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { connector?: string; url?: string; token?: string };
    const { url, token } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ ok: false, error: "url is required" }, { status: 400 });
    }

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const start = Date.now();
    let statusCode: number | undefined;
    let error: string | undefined;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      statusCode = res.status;
      const latencyMs = Date.now() - start;
      return NextResponse.json({
        ok: res.ok,
        latencyMs,
        statusCode,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      const latencyMs = Date.now() - start;
      return NextResponse.json({ ok: false, latencyMs, error });
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
