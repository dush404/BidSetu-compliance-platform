import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveBidder } from "@/lib/strapi-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerificationLogPayload {
  bidder?: { connect?: string[] };
  action?: string;
  timestamp?: string;
  complianceScore?: number | null;
  riskLevel?: string | null;
  aiSource?: string;
  detailsLog?: {
    recommendation?: string;
    riskLevel?: string;
    verificationMode?: string;
    [key: string]: unknown;
  };
}

/**
 * Strapi-compatible sink consumed by strapi_client.create_verification_log:
 *   POST /api/verification-logs  body: { data: { bidder: {connect: [documentId]}, action, ... } }
 * Each log becomes a VERIFICATION_COMPLETE audit entry in the officer timeline.
 */
export async function POST(req: NextRequest) {
  let body: { data?: VerificationLogPayload } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { status: 400, name: "BadRequestError", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const data = body.data;
  const documentId = data?.bidder?.connect?.[0];
  if (!documentId) {
    return NextResponse.json(
      { error: { status: 400, name: "BadRequestError", message: "Missing bidder connect" } },
      { status: 400 }
    );
  }

  const bidder = await resolveBidder(documentId);
  if (!bidder) {
    return NextResponse.json(
      { error: { status: 404, name: "NotFoundError", message: "Bidder not found" } },
      { status: 404 }
    );
  }

  const recommendationRaw = data.detailsLog?.recommendation;
  const decision =
    recommendationRaw === "MANUAL_REVIEW"
      ? "CLARIFY"
      : recommendationRaw === "DISQUALIFY"
        ? "DISQUALIFY"
        : recommendationRaw === "QUALIFY"
          ? "QUALIFY"
          : null;

  const audit = await db.auditEntry.create({
    data: {
      action: "VERIFICATION_COMPLETE",
      message: data.action ?? "Verification complete",
      bidderName: bidder.company,
      bidderId: bidder.id,
      tenderCode: bidder.tender.code,
      score: data.complianceScore ?? null,
      model: `AI Worker · ${data.aiSource ?? "Gemini 1.5 Flash"}`,
      officer: "ATC AI Worker",
      decision,
    },
  });

  return NextResponse.json({
    data: {
      id: audit.id,
      documentId: audit.id,
      attributes: { action: audit.action, createdAt: audit.createdAt.toISOString() },
    },
  });
}
