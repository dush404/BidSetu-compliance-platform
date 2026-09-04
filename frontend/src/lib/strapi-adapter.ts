// ============================================================
// Strapi-compatible adapter helpers
// ------------------------------------------------------------
// The user's Python AI worker (mini-services/ai-worker) talks to
// Strapi via strapi_client.py. Until the real Strapi backend is
// delivered, these helpers let Next.js API routes serve the exact
// REST dialect that strapi_client.py expects:
//
//   GET  /api/bidder-applications/{id}?populate=*
//   GET  /api/bidder-applications?filters[id][$eq]=...
//   PUT  /api/bidder-applications/{documentId}
//   GET  /api/{gst|pan|udyam|epfo|esic|startup-india|nsic}-databases?filters[<key>][$eq]=...
//   GET  /api/blacklist-databases?filters[$or][0][gstin][$eq]=...
//   POST /api/verification-logs
//
// When the real Strapi backend arrives, the worker's STRAPI_URL is
// repointed at it and these routes become dormant — zero worker changes.
// ============================================================

import { db } from "./db";

/** Strapi collection slug → the field strapi_client.py filters on. */
export const GOV_COLLECTIONS: Record<string, string> = {
  "gst-databases": "gstin",
  "udyam-databases": "udyamNumber",
  "pan-databases": "panNumber",
  "epfo-databases": "establishmentCode",
  "esic-databases": "esicCode",
  "startup-india-databases": "dpiitNumber",
  "nsic-databases": "nsicNumber",
};

export interface StrapiItem {
  id: number | string;
  documentId: string;
  attributes: Record<string, unknown>;
}

/** Wrap records in the Strapi envelope `{ data: [...] }`. */
export function strapiResponse(items: StrapiItem[]): { data: StrapiItem[] } {
  return { data: items };
}

/** Shape one record the way strapi_client.py unwraps it. */
export function strapiItem(
  id: string,
  attributes: Record<string, unknown>
): StrapiItem {
  return { id, documentId: id, attributes };
}

/**
 * Map a Prisma Bidder to the attribute names the AI worker expects
 * (verification_pipeline.run_verification reads these exact keys).
 */
export function bidderToWorkerAttributes(bidder: {
  id: string;
  contactName: string;
  company: string;
  gstin: string;
  pan: string;
  udyamId: string | null;
  epfoCode: string | null;
  esicCode: string | null;
  dpiitNumber: string | null;
  nsicNumber: string | null;
  status: string;
  score: number | null;
  risk: string | null;
  aiSummary: string | null;
  lastCheckedAt: Date | null;
  verificationResult: unknown;
}): Record<string, unknown> {
  const statusByInternal: Record<string, string> = {
    PENDING: "Pending",
    PROCESSING: "Pending",
    VERIFIED: "Verified",
    MANUAL_REVIEW: "Manual Review",
    REJECTED: "Rejected",
  };
  return {
    bidderName: bidder.contactName,
    companyName: bidder.company,
    gstin: bidder.gstin,
    panNumber: bidder.pan,
    udyamId: bidder.udyamId,
    epfoCode: bidder.epfoCode,
    esicCode: bidder.esicCode,
    dpiitNumber: bidder.dpiitNumber,
    nsicNumber: bidder.nsicNumber,
    verificationStatus: statusByInternal[bidder.status] ?? "Pending",
    complianceScore: bidder.score,
    riskLevel: bidder.risk,
    aiRecommendation: bidder.aiSummary,
    lastVerifiedAt: bidder.lastCheckedAt ? bidder.lastCheckedAt.toISOString() : null,
    verificationResult: bidder.verificationResult ?? null,
  };
}

/** Fetch a bidder by cuid id (works for both `id` and `documentId` semantics). */
export async function resolveBidder(id: string) {
  return db.bidder.findUnique({
    where: { id },
    include: { tender: { select: { id: true, code: true, title: true } } },
  });
}

/** Persist the worker's `save_verification_result` payload onto the bidder. */
export function verificationPayloadToBidderUpdate(data: {
  verificationStatus?: string;
  complianceScore?: number | null;
  riskLevel?: string | null;
  aiRecommendation?: string | null;
  verificationResult?: unknown;
  lastVerifiedAt?: string | null;
}) {
  const statusByRecommendation: Record<string, string> = {
    Verified: "VERIFIED",
    Rejected: "REJECTED",
    "Manual Review": "MANUAL_REVIEW",
  };
  const raw = data.verificationResult as
    | { verificationMode?: string }
    | null
    | undefined;
  return {
    status: statusByRecommendation[data.verificationStatus ?? ""] ?? "MANUAL_REVIEW",
    score: data.complianceScore ?? null,
    risk: (data.riskLevel ?? null)?.toUpperCase() ?? null,
    aiSummary: data.aiRecommendation ?? null,
    lastCheckedAt: data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : new Date(),
    dataSource: raw?.verificationMode ?? "SIMULATED_GOV_DATABASE",
    verificationResult: (data.verificationResult ?? undefined) as never,
  };
}

/**
 * Evaluate strapi_client.check_blacklist filters in JS.
 * Handles `filters[$or][N][field][$eq|$containsi]` and plain `filters[field][op]`.
 */
export function matchBlacklistRecords(
  params: URLSearchParams,
  records: { data: unknown }[]
): { data: unknown }[] {
  type Cond = { field: string; op: string; value: string };
  const orGroups: Cond[][] = [];
  const plain: Cond[] = [];

  const orRe = /^filters\[\$or\]\[(\d+)\]\[([^\]]+)\]\[([^\]]+)\]$/;
  const plainRe = /^filters\[([^\]$]+)\]\[([^\]]+)\]$/;

  for (const [key, value] of params.entries()) {
    const m = key.match(orRe);
    if (m) {
      const idx = Number(m[1]);
      (orGroups[idx] ??= []).push({ field: m[2], op: m[3], value });
      continue;
    }
    const p = key.match(plainRe);
    if (p && p[1] !== "$or") {
      plain.push({ field: p[1], op: p[2], value });
    }
  }

  const matches = (rec: Record<string, unknown>, c: Cond): boolean => {
    const fieldVal = rec[c.field];
    if (fieldVal == null) return false;
    const s = String(fieldVal);
    if (c.op === "$eq") return s === c.value;
    if (c.op === "$containsi")
      return s.toLowerCase().includes(c.value.toLowerCase());
    if (c.op === "$contains") return s.includes(c.value);
    return false;
  };

  return records.filter((r) => {
    const rec = r.data as Record<string, unknown>;
    const orOk =
      orGroups.length === 0 ||
      orGroups.some((group) => group && group.every((c) => matches(rec, c)));
    const plainOk = plain.every((c) => matches(rec, c));
    return orOk && plainOk;
  });
}

/** Load every record of a gov collection as raw data objects. */
export async function loadGovRecords(collection: string) {
  const rows = await db.govRecord.findMany({
    where: { collection },
    orderBy: { createdAt: "asc" },
  });
  return rows;
}
