import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fetch the last N buffered log events from the AI worker. */
export async function GET(req: NextRequest) {
  // Access control: only DEVELOPER role can view pipeline logs
  const roleCookie = req.cookies.get("atc_role")?.value;
  const roleHeader = req.headers.get("x-atc-role");
  const role = roleCookie || roleHeader;

  if (role && role !== "DEVELOPER") {
    return NextResponse.json({ error: "Forbidden: Developer access required" }, { status: 403 });
  }

  const limit = req.nextUrl.searchParams.get("limit") ?? "150";

  const candidateUrls = [
    process.env.AI_WORKER_URL,
    "http://localhost:8000",
    "http://localhost:3010",
  ].filter(Boolean) as string[];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/logs?limit=${limit}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ events: [], total: 0, error: "AI worker offline" });
}
