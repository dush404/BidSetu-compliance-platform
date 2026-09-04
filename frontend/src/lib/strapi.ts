import type {
  AuditEntry,
  BidderDetail,
  BidderDocument,
  BidderListItem,
  BidderStatus,
  ComplianceCheck,
  Recommendation,
  RiskLevel,
  Tender,
  TenderDetail,
  TenderStatus,
  VerificationListResponse,
} from "./types";
import { COMPLIANCE_CHECK_NAMES } from "./types";
import { mapWorkerResult, type WorkerVerificationResult } from "./ai-worker";

type StrapiEntity = {
  id: number | string;
  documentId?: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
};

type StrapiResponse = { data?: StrapiEntity[] | StrapiEntity | null };

const strapiUrl = process.env.STRAPI_URL?.replace(/\/+$/, "");
const token = process.env.STRAPI_API_TOKEN;

function fields(entity: StrapiEntity): Record<string, unknown> {
  return entity.attributes ?? entity;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function date(value: unknown): string {
  return typeof value === "string" ? value : new Date(0).toISOString();
}

function relationItems(value: unknown): StrapiEntity[] {
  if (!value || typeof value !== "object") return [];
  const data = (value as { data?: unknown }).data;
  if (Array.isArray(data)) return data as StrapiEntity[];
  if (data && typeof data === "object") return [data as StrapiEntity];
  if (Array.isArray(value)) return value as StrapiEntity[];
  return [value as StrapiEntity];
}

function mapStatus(value: unknown): TenderStatus {
  return text(value).toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN";
}

function mapBidderStatus(value: unknown): BidderStatus {
  const status = text(value).toUpperCase().replaceAll(" ", "_");
  if (
    status === "PROCESSING" ||
    status === "VERIFIED" ||
    status === "REJECTED" ||
    status === "MANUAL_REVIEW"
  ) {
    return status;
  }
  return "PENDING";
}

function mapRisk(value: unknown): RiskLevel | null {
  const risk = text(value).toUpperCase();
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(risk)
    ? (risk as RiskLevel)
    : null;
}

function mapBidder(entity: StrapiEntity): BidderListItem {
  const value = fields(entity);
  return {
    id: text(entity.documentId, String(entity.id)),
    contactName: text(value.bidderName),
    company: text(value.companyName),
    gstin: text(value.gstin),
    status: mapBidderStatus(value.verificationStatus),
    score: typeof value.complianceScore === "number" ? value.complianceScore : null,
    risk: mapRisk(value.riskLevel),
    lastCheckedAt: typeof value.lastVerifiedAt === "string" ? value.lastVerifiedAt : null,
  };
}

function mapTender(entity: StrapiEntity, bidders: BidderListItem[] = []): TenderDetail {
  const value = fields(entity);
  const tenderBidders = bidders.length
    ? bidders
    : relationItems(value.bidderApplications).map(mapBidder);

  return {
    id: text(entity.documentId, String(entity.id)),
    code: text(value.tenderId),
    title: text(value.title),
    department: text(value.department),
    category: text(value.category, "General"),
    status: mapStatus(value.statusId),
    publishedAt: date(value.publishedDate),
    closesAt: date(value.closingDate),
    value: text(value.value, "Not provided"),
    bidderCount:
      typeof value.bidderCount === "number" ? value.bidderCount : tenderBidders.length,
    stats: {
      total: tenderBidders.length,
      verified: tenderBidders.filter((b) => b.status === "VERIFIED").length,
      pending: tenderBidders.filter(
        (b) => b.status === "PENDING" || b.status === "PROCESSING"
      ).length,
      highRisk: tenderBidders.filter((b) => b.risk === "HIGH").length,
      critical: tenderBidders.filter((b) => b.risk === "CRITICAL").length,
    },
    bidders: tenderBidders,
  };
}

async function request(path: string, options?: RequestInit): Promise<StrapiResponse> {
  if (!strapiUrl) throw new Error("STRAPI_URL is not configured.");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${strapiUrl}/api/${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Strapi request failed (${response.status}): ${errorText}`);
  }
  return (await response.json()) as StrapiResponse;
}

export async function getStrapiTenders(query = ""): Promise<Tender[]> {
  const response = await request(
    `tenders?populate=*&pagination[pageSize]=100${query ? `&filters[$or][0][title][$containsi]=${encodeURIComponent(query)}&filters[$or][1][tenderId][$containsi]=${encodeURIComponent(query)}&filters[$or][2][department][$containsi]=${encodeURIComponent(query)}` : ""}`
  );
  const entities = Array.isArray(response.data) ? response.data : [];
  return entities.map((entity) => mapTender(entity));
}

export async function getStrapiTender(id: string): Promise<TenderDetail | null> {
  const response = await request(`tenders/${encodeURIComponent(id)}?populate=*`);
  if (!response.data || Array.isArray(response.data)) return null;
  return mapTender(response.data);
}

export async function getStrapiBidder(id: string): Promise<BidderDetail | null> {
  const response = await request(
    `bidder-applications/${encodeURIComponent(id)}?populate=*`
  );
  if (!response.data || Array.isArray(response.data)) return null;

  const value = fields(response.data);
  const tenderRelations = relationItems(value.tender);
  const tenderRelation = tenderRelations[0];
  const tenderValue = tenderRelation ? fields(tenderRelation) : {};
  const tenderId = tenderRelation
    ? text(tenderRelation.documentId, String(tenderRelation.id))
    : "";

  let rawResult: WorkerVerificationResult | null = null;
  if (value.verificationResult) {
    try {
      rawResult =
        typeof value.verificationResult === "string"
          ? JSON.parse(value.verificationResult)
          : (value.verificationResult as WorkerVerificationResult);
    } catch {
      rawResult = null;
    }
  }

  let mappedChecks: ComplianceCheck[] = [];
  let recommendation: Recommendation | null = null;
  let confidence: number | null = null;
  let dataSource: string | null = null;
  let failedChecks = 0;

  if (rawResult && rawResult.checks) {
    const outcome = mapWorkerResult(rawResult);
    mappedChecks = outcome.checks.map((c, i) => ({
      id: `${id}-check-${i}`,
      name: c.name,
      status: c.status,
      detail: c.detail,
      finding: c.finding,
      source: c.source,
      verifiedValue: c.verifiedValue,
    }));
    recommendation = outcome.recommendation;
    confidence = outcome.confidence;
    dataSource = outcome.dataSource;
    failedChecks = outcome.failedChecks;
  } else {
    mappedChecks = COMPLIANCE_CHECK_NAMES.map((name, i) => ({
      id: `${id}-check-${i}`,
      name,
      status: "NA" as const,
      detail: "Pending verification",
      finding: "This check will be evaluated when verification is run.",
      source: "Central Registry (Simulated)",
    }));
  }

  const documents: BidderDocument[] = relationItems(value.documents).map((doc, i) => {
    const docFields = fields(doc);
    return {
      id: text(doc.documentId, String(doc.id || i)),
      name: text(docFields.name || docFields.caption, `Document-${i + 1}.pdf`),
      type: text(docFields.ext, "PDF").replace(/^\./, "").toUpperCase(),
      size: typeof docFields.size === "number" ? `${Math.round(docFields.size)} KB` : "1.2 MB",
      uploadedAt: date(docFields.createdAt),
    };
  });

  const rawRec = text(value.aiRecommendation || value.verificationStatus);
  if (!recommendation) {
    if (rawRec.toUpperCase().includes("QUALIFY") || rawRec.toUpperCase() === "VERIFIED") recommendation = "QUALIFY";
    else if (rawRec.toUpperCase().includes("DISQUALIFY") || rawRec.toUpperCase() === "REJECTED") recommendation = "DISQUALIFY";
    else if (rawRec.toUpperCase().includes("REVIEW") || rawRec.toUpperCase().includes("MANUAL")) recommendation = "CLARIFY";
  }

  return {
    id: text(response.data.documentId, String(response.data.id)),
    tenderId,
    contactName: text(value.bidderName),
    company: text(value.companyName),
    gstin: text(value.gstin),
    pan: text(value.panNumber),
    status: mapBidderStatus(value.verificationStatus),
    score: typeof value.complianceScore === "number" ? value.complianceScore : null,
    risk: mapRisk(value.riskLevel),
    recommendation,
    aiSummary: typeof value.aiRecommendation === "string" ? value.aiRecommendation : null,
    confidence: confidence ?? (typeof value.complianceScore === "number" ? 95 : null),
    lastCheckedAt: typeof value.lastVerifiedAt === "string" ? value.lastVerifiedAt : null,
    dataSource: dataSource ?? (value.lastVerifiedAt ? "SIMULATED_GOV_DATABASE" : null),
    failedChecks,
    tender: {
      id: tenderId,
      code: text(tenderValue.tenderId, "TND"),
      title: text(tenderValue.title, "Tender"),
      department: text(tenderValue.department, "Department"),
    },
    checks: mappedChecks,
    documents,
  };
}

export async function updateStrapiBidder(id: string, data: Record<string, unknown>) {
  return request(`bidder-applications/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}

export async function createStrapiVerificationLog(
  documentId: string,
  action: string,
  details: {
    score?: number | null;
    riskLevel?: string | null;
    aiSource?: string;
    detailsLog?: Record<string, unknown>;
  }
) {
  return request("verification-logs", {
    method: "POST",
    body: JSON.stringify({
      data: {
        bidder: { connect: [documentId] },
        action,
        timestamp: new Date().toISOString(),
        complianceScore: details.score ?? null,
        riskLevel: details.riskLevel === "Critical" ? "High" : (details.riskLevel ?? "Low"),
        aiSource: details.aiSource ?? "Gemini 1.5 Flash",
        detailsLog: details.detailsLog ?? {},
      },
    }),
  });
}

export async function getStrapiVerifications(): Promise<VerificationListResponse["results"]> {
  const response = await request(
    "bidder-applications?populate=*&pagination[pageSize]=100&filters[verificationStatus][$ne]=Pending&sort=updatedAt:desc"
  );
  const entities = Array.isArray(response.data) ? response.data : [];
  return entities.map((entity) => {
    const value = fields(entity);
    const tenderRel = relationItems(value.tender)[0];
    const tenderVal = tenderRel ? fields(tenderRel) : {};
    const status = mapBidderStatus(value.verificationStatus);
    const rec: Recommendation = status === "VERIFIED" ? "QUALIFY" : status === "REJECTED" ? "DISQUALIFY" : "CLARIFY";

    return {
      id: text(entity.documentId, String(entity.id)),
      tenderId: tenderRel ? text(tenderRel.documentId, String(tenderRel.id)) : "",
      contactName: text(value.bidderName),
      company: text(value.companyName),
      gstin: text(value.gstin),
      pan: text(value.panNumber),
      status,
      score: typeof value.complianceScore === "number" ? value.complianceScore : null,
      risk: mapRisk(value.riskLevel),
      recommendation: rec,
      aiSummary: typeof value.aiRecommendation === "string" ? value.aiRecommendation : null,
      confidence: 95,
      lastCheckedAt: typeof value.lastVerifiedAt === "string" ? value.lastVerifiedAt : null,
      dataSource: "SIMULATED_GOV_DATABASE",
      failedChecks: 0,
      tenderCode: text(tenderVal.tenderId, "TND"),
      tenderTitle: text(tenderVal.title, "Tender"),
    };
  });
}

export async function getStrapiAuditLogs(): Promise<AuditEntry[]> {
  const response = await request(
    "verification-logs?populate=*&sort=createdAt:desc&pagination[pageSize]=60"
  );
  const entities = Array.isArray(response.data) ? response.data : [];
  return entities.map((entity) => {
    const value = fields(entity);
    const bidderRel = relationItems(value.bidder)[0];
    const bidderVal = bidderRel ? fields(bidderRel) : {};
    const act = text(value.action);
    let decision: Recommendation | null = null;
    if (act.toUpperCase().includes("QUALIFY")) decision = "QUALIFY";
    else if (act.toUpperCase().includes("DISQUALIFY") || act.toUpperCase().includes("REJECT")) decision = "DISQUALIFY";
    else if (act.toUpperCase().includes("CLARIFY") || act.toUpperCase().includes("REVIEW")) decision = "CLARIFY";

    return {
      id: text(entity.documentId, String(entity.id)),
      action: act.includes("decision") ? "OFFICER_DECISION" : "VERIFICATION_COMPLETE",
      message: act,
      bidderName: text(bidderVal.companyName || bidderVal.bidderName) || null,
      bidderId: bidderRel ? text(bidderRel.documentId, String(bidderRel.id)) : null,
      tenderCode: null,
      decision,
      score: typeof value.complianceScore === "number" ? value.complianceScore : null,
      model: text(value.aiSource, "AI Worker · Gemini 1.5 Flash"),
      officer: act.includes("decision") ? "Procurement Officer" : "ATC AI Worker",
      createdAt: date(entity.createdAt || value.timestamp),
    };
  });
}
