import { NextRequest, NextResponse } from "next/server";
import {
  bidderToWorkerAttributes,
  resolveBidder,
  strapiItem,
  strapiResponse,
} from "@/lib/strapi-adapter";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Strapi-compatible list endpoint consumed by strapi_client.get_bidder's
 * fallback path: GET /api/bidder-applications?filters[id][$eq]=<id>&populate=*
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const idFilter = params.get("filters[id][$eq]");

  if (idFilter) {
    const bidder = await resolveBidder(idFilter);
    if (!bidder) return NextResponse.json(strapiResponse([]));
    return NextResponse.json(
      strapiResponse([
        strapiItem(bidder.id, bidderToWorkerAttributes(bidder)),
      ])
    );
  }

  // Unfiltered list — shape-compatible passthrough.
  const bidders = await db.bidder.findMany({
    include: { tender: { select: { id: true, code: true, title: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    strapiResponse(
      bidders.map((b) => strapiItem(b.id, bidderToWorkerAttributes(b)))
    )
  );
}
