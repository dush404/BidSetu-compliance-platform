// ============================================================
// AI Tender Compliance Platform — Simulated Verification Engine
// Shared by prisma/seed.ts and POST /api/bidders/[id]/verify so
// seed data and live verification output stay consistent.
// Deterministic: outcomes derive from a djb2 hash of the bidder id.
// ============================================================

import { db } from "./db";
import { COMPLIANCE_CHECK_NAMES } from "./types";
import type {
  AuditEntry,
  BidderDetail,
  BidderStatus,
  CheckStatus,
  ComplianceCheck,
  Recommendation,
  RiskLevel,
} from "./types";

export type VerificationStatus = "VERIFIED" | "MANUAL_REVIEW" | "REJECTED";

export interface VerificationCheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
  finding: string;
  source: string;
  verifiedValue?: string;
}

export interface VerificationOutcome {
  status: VerificationStatus;
  score: number;
  risk: RiskLevel;
  recommendation: Recommendation;
  aiSummary: string;
  aiSource?: string;
  confidence: number;
  lastCheckedAt: Date;
  dataSource: string;
  failedChecks: number;
  checks: VerificationCheckResult[];
}

export interface ForcedCheck {
  status: CheckStatus;
  detail: string;
  finding: string;
  verifiedValue?: string;
}

export interface VerificationOptions {
  /** Override the natural (hash-derived) outcome of specific checks. Used by the seed for narrative scenarios. */
  forceChecks?: Partial<Record<string, ForcedCheck>>;
}

const MODEL_LABEL = "ATC Engine v2 · Gemini 1.5 Flash";
const DATA_SOURCE = "SIMULATED_GOV_DATABASE";

// ---- deterministic hash (djb2) ----

export function djb2Hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ---- check templates (also used to build seed overrides) ----

interface CheckContext {
  company: string;
  gstin: string;
  pan: string;
}

type CheckTemplate = Omit<VerificationCheckResult, "name" | "source">;

export function checkTemplate(
  name: string,
  variant: CheckStatus,
  ctx: CheckContext
): CheckTemplate {
  const { company, gstin, pan } = ctx;
  switch (name) {
    case "GST Registration":
      if (variant === "REVIEW") {
        return {
          status: "REVIEW",
          detail: "GST returns not filed recently",
          finding: `GSTIN ${gstin} is registered and active on the GSTN portal, however the last two GSTR-3B returns were not filed by their due dates. Supporting filings should be obtained from the bidder before financial evaluation.`,
          verifiedValue: "Returns: Overdue",
        };
      }
      return {
        status: "PASS",
        detail: "Active GSTIN verified on GSTN portal",
        finding: `GSTIN ${gstin} is active on the GSTN portal and registered against the same legal entity name. The most recent GSTR-3B filing is within the statutory window.`,
        verifiedValue: "Status: Active",
      };
    case "PAN Compliance":
      return {
        status: "PASS",
        detail: "PAN active, no adverse notices",
        finding: `PAN ${pan} is in active status with the Income Tax Department. No outstanding demands or adverse assessment orders were found for the entity.`,
        verifiedValue: "Status: Active",
      };
    case "Udyam / MSME":
      return {
        status: "PASS",
        detail: "Udyam registration confirmed",
        finding: `The Udyam registration submitted by ${company} maps to a valid MSME entity. Enterprise class and NIC activity code are consistent with the scope of the bid.`,
        verifiedValue: "Udyam: Registered",
      };
    case "EPFO Compliance":
      return {
        status: "PASS",
        detail: "EPFO establishment active",
        finding: `The EPFO establishment ID linked to ${company} is active. The latest ECR challan was cleared in full and no default notices are on record.`,
        verifiedValue: "ECR: Filed",
      };
    case "ESIC Compliance":
      return {
        status: "PASS",
        detail: "ESIC registration active",
        finding: `ESIC registration for ${company} is active with the Employees' State Insurance Corporation. No pending contribution disputes were found.`,
        verifiedValue: "Contributions: Clear",
      };
    case "Startup India (DPIIT)":
      if (variant === "NA") {
        return {
          status: "NA",
          detail: "No DPIIT number submitted.",
          finding:
            "Bidder did not submit a Startup India (DPIIT) recognition number, so recognition could not be verified. This does not affect eligibility for this tender.",
          verifiedValue: "Recognized: N/A",
        };
      }
      return {
        status: "PASS",
        detail: "DPIIT recognition verified",
        finding: `The Startup India (DPIIT) recognition number submitted by ${company} was matched against the DPIIT registry. The recognition certificate is valid and not revoked.`,
        verifiedValue: "Recognized: true",
      };
    case "NSIC Registration":
      if (variant === "NA") {
        return {
          status: "NA",
          detail: "No NSIC number submitted.",
          finding:
            "Bidder did not submit an NSIC registration number, so registration could not be verified. This does not affect eligibility for this tender.",
          verifiedValue: "Registered: N/A",
        };
      }
      return {
        status: "PASS",
        detail: "NSIC registration verified",
        finding: `The NSIC registration submitted by ${company} was verified against the NSIC registry. The Single Point Registration certificate is current.`,
        verifiedValue: "Registered: true",
      };
    case "Blacklist / Debarment":
      if (variant === "FAIL") {
        return {
          status: "FAIL",
          detail: "Entity found in blacklist/debarment registry.",
          finding: `${company} appears in the central debarment registry with an active exclusion order. As per CVC guidelines the bid is ineligible for qualification.`,
          verifiedValue: "Blacklisted: true",
        };
      }
      return {
        status: "PASS",
        detail: "No debarment records found",
        finding: `${company} was searched across the central debarment and blacklist registries. No adverse entries were found against the entity or its directors.`,
        verifiedValue: "Blacklisted: false",
      };
    default:
      return {
        status: "NA",
        detail: "Check not applicable.",
        finding: "This check is not applicable to the submitted bid documents.",
      };
  }
}

const CHECK_SOURCES: Record<string, string> = {
  "GST Registration": "GSTN (Simulated)",
  "PAN Compliance": "Income Tax Dept. (Simulated)",
  "Udyam / MSME": "MSME Ministry (Simulated)",
  "EPFO Compliance": "EPFO (Simulated)",
  "ESIC Compliance": "ESIC (Simulated)",
  "Startup India (DPIIT)": "DPIIT (Simulated)",
  "NSIC Registration": "NSIC (Simulated)",
  "Blacklist / Debarment": "Central Registry (Simulated)",
};

// ---- core engine ----

export async function runVerificationForBidder(
  bidderId: string,
  opts?: VerificationOptions
): Promise<VerificationOutcome> {
  const bidder = await db.bidder.findUnique({
    where: { id: bidderId },
    select: { company: true, gstin: true, pan: true },
  });
  if (!bidder) {
    throw new Error(`Bidder not found: ${bidderId}`);
  }

  const h = djb2Hash(bidderId);
  const ctx: CheckContext = {
    company: bidder.company,
    gstin: bidder.gstin,
    pan: bidder.pan,
  };
  const forced = opts?.forceChecks ?? {};

  const build = (name: string): VerificationCheckResult => {
    const f = forced[name];
    if (f) return { name, source: CHECK_SOURCES[name] ?? "Central Registry (Simulated)", ...f };
    let variant: CheckStatus;
    switch (name) {
      case "GST Registration":
        variant = h % 3 === 0 ? "REVIEW" : "PASS";
        break;
      case "Startup India (DPIIT)":
        variant = h % 4 === 1 ? "PASS" : "NA";
        break;
      case "Blacklist / Debarment":
        variant = h % 11 === 7 ? "FAIL" : "PASS";
        break;
      default:
        variant = name === "NSIC Registration" ? "NA" : "PASS";
    }
    return { name, source: CHECK_SOURCES[name] ?? "Central Registry (Simulated)", ...checkTemplate(name, variant, ctx) };
  };

  const checks: VerificationCheckResult[] = COMPLIANCE_CHECK_NAMES.map(build);

  // ---- scoring: 100 - 16/FAIL - 32/REVIEW - 6/NA - hash jitter, clamped ----
  // PASS-all (2 NAs) ≈ 88-90 · single GST REVIEW ≈ 56-58 (CLARIFY) · any FAIL ⇒ 0 (DISQUALIFY)
  const fails = checks.filter((c) => c.status === "FAIL").length;
  const reviews = checks.filter((c) => c.status === "REVIEW").length;
  const nas = checks.filter((c) => c.status === "NA").length;
  const passed = checks.filter((c) => c.status === "PASS").length;

  let score = 100 - 16 * fails - 32 * reviews - 6 * nas - (h % 3);
  score = Math.max(0, Math.min(100, score));
  if (fails > 0) score = 0;

  const risk: RiskLevel =
    fails > 0 ? "CRITICAL" : score >= 80 ? "LOW" : score >= 60 ? "MEDIUM" : score >= 35 ? "HIGH" : "CRITICAL";

  const recommendation: Recommendation =
    fails > 0 ? "DISQUALIFY" : reviews > 0 && score < 70 ? "CLARIFY" : score < 60 ? "CLARIFY" : "QUALIFY";

  const status: VerificationStatus =
    recommendation === "QUALIFY" ? "VERIFIED" : recommendation === "CLARIFY" ? "MANUAL_REVIEW" : "REJECTED";

  const confidence = 88 + (h % 10); // 88-97

  let aiSummary: string;
  if (fails > 0) {
    const failedName = checks.find((c) => c.status === "FAIL")?.name ?? "critical check";
    aiSummary = `${bidder.company} completed automated compliance screening with a score of ${score}/100, passing ${passed} of ${checks.length} checks. The check "${failedName}" failed, which is a critical adverse finding under prevailing procurement guidelines. Recommendation: DISQUALIFY.`;
  } else if (recommendation === "CLARIFY") {
    aiSummary = `${bidder.company} completed automated compliance screening with a score of ${score}/100, passing ${passed} of ${checks.length} checks. ${reviews} check${reviews === 1 ? " was" : "s were"} flagged for review and should be clarified with the bidder before financial evaluation. Recommendation: CLARIFY.`;
  } else {
    aiSummary = `${bidder.company} completed automated compliance screening with a score of ${score}/100, passing ${passed} of ${checks.length} checks. All core statutory registrations verified active and no adverse registry entries were found. Recommendation: QUALIFY.`;
  }

  return {
    status,
    score,
    risk,
    recommendation,
    aiSummary,
    confidence,
    lastCheckedAt: new Date(),
    dataSource: DATA_SOURCE,
    failedChecks: fails,
    checks,
  };
}

// ---- persistence + shared fetchers ----

export async function persistVerificationResult(
  bidderId: string,
  outcome: VerificationOutcome
): Promise<void> {
  await db.$transaction([
    db.complianceCheck.deleteMany({ where: { bidderId } }),
    db.bidder.update({
      where: { id: bidderId },
      data: {
        status: outcome.status,
        score: outcome.score,
        risk: outcome.risk,
        recommendation: outcome.recommendation,
        aiSummary: outcome.aiSummary,
        confidence: outcome.confidence,
        lastCheckedAt: outcome.lastCheckedAt,
        dataSource: outcome.dataSource,
        failedChecks: outcome.failedChecks,
      },
    }),
    db.bidder.update({
      where: { id: bidderId },
      data: {
        checks: {
          create: outcome.checks.map((c) => ({
            name: c.name,
            status: c.status,
            detail: c.detail,
            finding: c.finding,
            source: c.source,
            verifiedValue: c.verifiedValue ?? null,
          })),
        },
      },
    }),
  ]);
}

export async function fetchBidderDetail(bidderId: string): Promise<BidderDetail | null> {
  const bidder = await db.bidder.findUnique({
    where: { id: bidderId },
    include: {
      tender: { select: { id: true, code: true, title: true, department: true } },
      checks: true,
      documents: { orderBy: { uploadedAt: "asc" } },
    },
  });
  if (!bidder) return null;

  const order = new Map<string, number>(COMPLIANCE_CHECK_NAMES.map((n, i) => [n as string, i]));
  const checks = [...bidder.checks].sort(
    (a, b) => (order.get(a.name) ?? 99) - (order.get(b.name) ?? 99)
  );

  return {
    id: bidder.id,
    tenderId: bidder.tenderId,
    contactName: bidder.contactName,
    company: bidder.company,
    gstin: bidder.gstin,
    pan: bidder.pan,
    status: bidder.status as BidderStatus,
    score: bidder.score,
    risk: (bidder.risk ?? null) as RiskLevel | null,
    recommendation: (bidder.recommendation ?? null) as Recommendation | null,
    aiSummary: bidder.aiSummary,
    confidence: bidder.confidence,
    lastCheckedAt: bidder.lastCheckedAt ? bidder.lastCheckedAt.toISOString() : null,
    dataSource: bidder.dataSource,
    failedChecks: bidder.failedChecks,
    tender: bidder.tender,
    checks: checks.map(
      (c): ComplianceCheck => ({
        id: c.id,
        name: c.name,
        status: c.status as CheckStatus,
        detail: c.detail,
        finding: c.finding,
        source: c.source,
        verifiedValue: c.verifiedValue ?? undefined,
      })
    ),
    documents: bidder.documents.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      size: d.size,
      uploadedAt: d.uploadedAt.toISOString(),
    })),
  };
}

export function mapAuditEntry(e: {
  id: string;
  action: string;
  message: string;
  bidderName: string | null;
  bidderId: string | null;
  tenderCode: string | null;
  decision: string | null;
  score: number | null;
  model: string | null;
  officer: string | null;
  createdAt: Date;
}): AuditEntry {
  return {
    id: e.id,
    action: e.action as AuditEntry["action"],
    message: e.message,
    bidderName: e.bidderName,
    bidderId: e.bidderId,
    tenderCode: e.tenderCode,
    decision: (e.decision ?? null) as AuditEntry["decision"],
    score: e.score,
    model: e.model,
    officer: e.officer,
    createdAt: e.createdAt.toISOString(),
  };
}

export function auditMessageFor(recommendation: Recommendation): string {
  return `Verification complete — ${recommendation}`;
}

export { MODEL_LABEL };
