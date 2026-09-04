import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE proxy — forwards the AI worker's /log-stream to the browser.
 * The worker streams newline-delimited "data: {...}\n\n" frames.
 */
export async function GET(req: NextRequest) {
  // Access control: only DEVELOPER role can subscribe to pipeline stream
  const roleCookie = req.cookies.get("atc_role")?.value;
  const roleHeader = req.headers.get("x-atc-role");
  const role = roleCookie || roleHeader;

  if (role && role !== "DEVELOPER") {
    return new Response(JSON.stringify({ error: "Forbidden: Developer access required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const candidateUrls = [
    process.env.AI_WORKER_URL,
    "http://localhost:8000",
    "http://localhost:3010",
  ].filter(Boolean) as string[];

  let workerRes: Response | null = null;
  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/log-stream`, {
        cache: "no-store",
        headers: { Accept: "text/event-stream" },
        // No AbortSignal — we want the stream to stay open
      });
      if (res.ok && res.body) {
        workerRes = res;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!workerRes?.body) {
    // Worker offline — stream a synthetic error event and close
    const encoder = new TextEncoder();
    const offlineBody = new ReadableStream({
      start(ctrl) {
        const ev = JSON.stringify({
          ts: new Date().toISOString(),
          stage: "SYSTEM",
          level: "ERROR",
          msg: "AI worker offline — cannot stream logs",
          data: {},
        });
        ctrl.enqueue(encoder.encode(`data: ${ev}\n\n`));
        ctrl.close();
      },
    });
    return new Response(offlineBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Pipe the worker stream straight to the client
  return new Response(workerRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
