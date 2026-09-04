import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  auditMessageFor,
  fetchBidderDetail,
  mapAuditEntry,
  MODEL_LABEL,
  persistVerificationResult,
  runVerificationForBidder,
  type VerificationOutcome,
} from "@/lib/verification";
import { runAiWorkerVerification, WORKER_MODEL_LABEL } from "@/lib/ai-worker";
import {
  createStrapiVerificationLog,
  getStrapiBidder,
  updateStrapiBidder,
} from "@/lib/strapi";
import type { AuditEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Try resolving as Strapi bidder first
  const strapiBidder = await getStrapiBidder(id).catch(() => null);

  if (strapiBidder) {
    // Optimistically set to Processing in Strapi
    await updateStrapiBidder(id, { verificationStatus: "Processing" }).catch(() => null);

    let outcome: VerificationOutcome;
    let usedWorker = false;
    try {
      outcome = await runAiWorkerVerification(id);
      usedWorker = true;
    } catch (err) {
      console.warn(
        "[verify] AI worker error or unavailable for Strapi bidder, using simulated verification:",
        err instanceof Error ? err.message : err
      );
      outcome = await runVerificationForBidder(id);
      outcome.dataSource = "LOCAL_ENGINE_FALLBACK";

      const statusByRec: Record<string, string> = {
        QUALIFY: "Verified",
        DISQUALIFY: "Rejected",
        CLARIFY: "Manual Review",
      };
      await updateStrapiBidder(id, {
        verificationStatus: statusByRec[outcome.recommendation] ?? "Manual Review",
        complianceScore: outcome.score,
        riskLevel:
          outcome.risk === "LOW"
            ? "Low"
            : outcome.risk === "MEDIUM"
              ? "Medium"
              : outcome.risk === "HIGH"
                ? "High"
                : "Critical",
        aiRecommendation: outcome.aiSummary,
        lastVerifiedAt: new Date().toISOString(),
        verificationResult: outcome,
      }).catch(() => null);

      await createStrapiVerificationLog(
        id,
        `Verification complete — ${outcome.recommendation}`,
        {
          score: outcome.score,
          riskLevel:
            outcome.risk === "LOW"
              ? "Low"
              : outcome.risk === "MEDIUM"
                ? "Medium"
                : "High",
          aiSource: outcome.aiSource ?? (usedWorker ? "AI Worker" : "Simulated Engine"),
          detailsLog: outcome as unknown as Record<string, unknown>,
        }
      ).catch(() => null);
    }

    const detail = await getStrapiBidder(id);
    const resolvedModel = outcome.aiSource
      ? `AI Worker · ${outcome.aiSource}`
      : usedWorker
        ? WORKER_MODEL_LABEL
        : MODEL_LABEL;

    const audit: AuditEntry = {
      id: `audit-${Date.now()}`,
      action: "VERIFICATION_COMPLETE",
      message: auditMessageFor(outcome.recommendation),
      bidderName: detail?.company ?? strapiBidder.company,
      bidderId: id,
      tenderCode: detail?.tender?.code ?? strapiBidder.tender.code,
      decision: outcome.recommendation,
      score: outcome.score,
      model: resolvedModel,
      officer: usedWorker ? "ATC AI Worker" : "Procurement Officer",
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ bidder: detail ?? strapiBidder, audit });
  }

  // 2. Fallback to Prisma SQLite db.bidder
  const bidder = await db.bidder.findUnique({
    where: { id },
    include: { tender: { select: { code: true } } },
  });
  if (!bidder) {
    return NextResponse.json({ error: "Bidder not found." }, { status: 404 });
  }

  await db.bidder.update({ where: { id }, data: { status: "PROCESSING" } });

  let outcome: VerificationOutcome;
  let usedWorker = false;
  try {
    outcome = await runAiWorkerVerification(id);
    usedWorker = true;
  } catch (err) {
    console.warn(
      "[verify] AI worker unavailable, falling back to local engine:",
      err instanceof Error ? err.message : err
    );
    outcome = await runVerificationForBidder(id);
    outcome.dataSource = "LOCAL_ENGINE_FALLBACK";
  }

  await persistVerificationResult(id, outcome);

  let audit;
  if (usedWorker) {
    audit = await db.auditEntry.findFirst({
      where: { bidderId: id, action: "VERIFICATION_COMPLETE" },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!audit) {
    audit = await db.auditEntry.create({
      data: {
        action: "VERIFICATION_COMPLETE",
        message: auditMessageFor(outcome.recommendation),
        bidderName: bidder.company,
        bidderId: id,
        tenderCode: bidder.tender.code,
        score: outcome.score,
        model: outcome.aiSource
          ? `AI Worker · ${outcome.aiSource}`
          : usedWorker
            ? WORKER_MODEL_LABEL
            : MODEL_LABEL,
        officer: usedWorker ? "ATC AI Worker" : "Procurement Officer",
      },
    });
  }

  const [detail, mappedAudit] = await Promise.all([
    fetchBidderDetail(id),
    Promise.resolve(mapAuditEntry(audit)),
  ]);
  if (!detail) {
    return NextResponse.json({ error: "Bidder not found." }, { status: 404 });
  }

  return NextResponse.json({ bidder: detail, audit: mappedAudit });
}
