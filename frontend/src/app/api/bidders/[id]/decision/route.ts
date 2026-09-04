import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchBidderDetail, mapAuditEntry } from "@/lib/verification";
import {
  createStrapiVerificationLog,
  getStrapiBidder,
  updateStrapiBidder,
} from "@/lib/strapi";
import type { AuditEntry, Recommendation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BY_DECISION: Record<Recommendation, string> = {
  QUALIFY: "VERIFIED",
  CLARIFY: "MANUAL_REVIEW",
  DISQUALIFY: "REJECTED",
};

const STRAPI_STATUS_BY_DECISION: Record<Recommendation, string> = {
  QUALIFY: "Verified",
  CLARIFY: "Manual Review",
  DISQUALIFY: "Rejected",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const decision = body?.decision as Recommendation | undefined;
  if (typeof body?.note !== "undefined" && typeof body?.note !== "string") {
    return NextResponse.json({ error: "note must be a string." }, { status: 400 });
  }

  if (decision !== "QUALIFY" && decision !== "CLARIFY" && decision !== "DISQUALIFY") {
    return NextResponse.json(
      { error: 'decision must be one of "QUALIFY", "CLARIFY" or "DISQUALIFY".' },
      { status: 400 }
    );
  }

  // 1. Check if Strapi bidder
  const strapiBidder = await getStrapiBidder(id).catch(() => null);
  if (strapiBidder) {
    const noteText = body?.note ? ` — Note: ${body.note}` : "";
    const actionText = `Officer decision — ${decision}${noteText}`;

    await updateStrapiBidder(id, {
      verificationStatus: STRAPI_STATUS_BY_DECISION[decision],
      aiRecommendation: actionText,
    }).catch(() => null);

    await createStrapiVerificationLog(id, actionText, {
      score: strapiBidder.score,
      riskLevel:
        strapiBidder.risk === "LOW"
          ? "Low"
          : strapiBidder.risk === "MEDIUM"
            ? "Medium"
            : "High",
      aiSource: "Procurement Officer",
      detailsLog: { decision, note: body?.note },
    }).catch(() => null);

    const detail = await getStrapiBidder(id);
    const audit: AuditEntry = {
      id: `audit-${Date.now()}`,
      action: "OFFICER_DECISION",
      message: actionText,
      decision,
      bidderName: detail?.company ?? strapiBidder.company,
      bidderId: id,
      tenderCode: detail?.tender?.code ?? strapiBidder.tender.code,
      score: detail?.score ?? strapiBidder.score,
      model: null,
      officer: "Procurement Officer",
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, bidder: detail ?? strapiBidder, audit });
  }

  // 2. Fallback to Prisma SQLite db.bidder
  const bidder = await db.bidder.findUnique({
    where: { id },
    include: { tender: { select: { code: true } } },
  });
  if (!bidder) {
    return NextResponse.json({ error: "Bidder not found." }, { status: 404 });
  }

  await db.bidder.update({
    where: { id },
    data: { status: STATUS_BY_DECISION[decision], recommendation: decision },
  });

  const audit = await db.auditEntry.create({
    data: {
      action: "OFFICER_DECISION",
      message: `Officer decision — ${decision}`,
      decision,
      bidderName: bidder.company,
      bidderId: id,
      tenderCode: bidder.tender.code,
      score: bidder.score,
      model: null,
      officer: "Procurement Officer",
    },
  });

  const detail = await fetchBidderDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Bidder not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, bidder: detail, audit: mapAuditEntry(audit) });
}
