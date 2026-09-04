import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  bidderToWorkerAttributes,
  resolveBidder,
  strapiItem,
  strapiResponse,
  verificationPayloadToBidderUpdate,
} from "@/lib/strapi-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Strapi-compatible item endpoint consumed by strapi_client.get_bidder:
 *   GET /api/bidder-applications/{id}?populate=*
 * The worker passes our bidder cuid through as `bidder_id`.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bidder = await resolveBidder(id);
  if (!bidder) return NextResponse.json(strapiResponse([]));
  return NextResponse.json(
    strapiResponse([strapiItem(bidder.id, bidderToWorkerAttributes(bidder))])
  );
}

/**
 * Strapi-compatible update endpoint consumed by strapi_client.save_verification_result:
 *   PUT /api/bidder-applications/{documentId}   body: { data: {...} }
 * Persists the AI worker's verification snapshot onto the bidder.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bidder = await resolveBidder(id);
  if (!bidder) {
    return NextResponse.json(
      { error: { status: 404, name: "NotFoundError", message: "Not Found" } },
      { status: 404 }
    );
  }

  let body: { data?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { status: 400, name: "BadRequestError", message: "Invalid JSON" } },
      { status: 400 }
    );
  }
  const data = body.data;
  if (typeof data !== "object" || data === null) {
    return NextResponse.json(
      { error: { status: 400, name: "BadRequestError", message: "Missing data" } },
      { status: 400 }
    );
  }

  await db.bidder.update({
    where: { id: bidder.id },
    data: verificationPayloadToBidderUpdate(
      data as Parameters<typeof verificationPayloadToBidderUpdate>[0]
    ),
  });

  const updated = await resolveBidder(bidder.id);
  return NextResponse.json(
    strapiResponse([strapiItem(bidder.id, bidderToWorkerAttributes(updated!))])
  );
}
