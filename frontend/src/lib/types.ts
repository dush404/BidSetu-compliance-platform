// ============================================================
// AI Tender Compliance Platform — Shared API Contract
// Used by both API route handlers and the frontend client.
// ============================================================

export type TenderStatus = "OPEN" | "CLOSED";

export interface Tender {
  id: string;
  code: string; // e.g. TND-2024-005
  title: string;
  department: string; // e.g. Ministry of New & Renewable Energy
  category: string; // e.g. Energy | Health | IT | Construction
  status: TenderStatus;
  publishedAt: string; // ISO datetime
  closesAt: string; // ISO datetime
  value: string; // contract value display, e.g. "₹42 Cr"
  bidderCount: number;
}

export interface TenderStats {
  total: number;
  verified: number;
  pending: number;
  highRisk: number;
  critical: number;
}

export interface BidderListItem {
  id: string;
  contactName: string;
  company: string;
  gstin: string;
  status: BidderStatus;
  score: number | null;
  risk: RiskLevel | null;
  lastCheckedAt: string | null;
}

export interface TenderDetail extends Tender {
  stats: TenderStats;
  bidders: BidderListItem[];
}

export type BidderStatus =
  | "PENDING"
  | "PROCESSING"
  | "VERIFIED"
  | "MANUAL_REVIEW"
  | "REJECTED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Recommendation = "QUALIFY" | "CLARIFY" | "DISQUALIFY";

export interface Bidder {
  id: string;
  tenderId: string;
  contactName: string;
  company: string;
  gstin: string;
  pan: string;
  status: BidderStatus;
  score: number | null;
  risk: RiskLevel | null;
  recommendation: Recommendation | null;
  aiSummary: string | null;
  confidence: number | null; // 0-100
  lastCheckedAt: string | null;
  dataSource: string | null; // e.g. "SIMULATED_GOV_DATABASE"
  failedChecks: number;
}

export type CheckStatus = "PASS" | "FAIL" | "REVIEW" | "NA";

export interface ComplianceCheck {
  id: string;
  name: string; // "GST Registration"
  status: CheckStatus;
  detail: string; // short summary line
  finding: string; // expanded detail shown in accordion
  source: string; // "GSTN (Simulated)"
  verifiedValue?: string; // e.g. "Blacklisted: false"
}

export interface BidderDocument {
  id: string;
  name: string;
  type: string; // "PDF" | "Image"
  size: string; // "1.2 MB"
  uploadedAt: string;
}

export interface BidderDetail extends Bidder {
  tender: { id: string; code: string; title: string; department: string };
  checks: ComplianceCheck[];
  documents: BidderDocument[];
}

export type AuditAction =
  | "VERIFICATION_COMPLETE"
  | "OFFICER_DECISION"
  | "BATCH_VERIFICATION"
  | "SESSION";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  message: string; // "Verification complete — QUALIFY"
  bidderName: string | null;
  bidderId: string | null;
  tenderCode: string | null;
  decision: Recommendation | null;
  score: number | null;
  model: string | null; // "ATC Engine v2 · Gemini 1.5 Flash"
  officer: string | null;
  createdAt: string;
}

export interface SessionUser {
  name: string;
  email: string;
  role: "OFFICER" | "DEVELOPER";
  department: string;
  location?: string; // e.g. "New Delhi, India"
}

// ---- API response envelopes ----

export interface LoginResponse {
  ok: boolean;
  user: SessionUser;
}

export interface TendersResponse {
  tenders: Tender[];
}

export interface TenderDetailResponse {
  tender: TenderDetail;
}

export interface BidderDetailResponse {
  bidder: BidderDetail;
}

export interface VerifyResponse {
  bidder: BidderDetail;
  audit: AuditEntry;
}

export interface DecisionResponse {
  ok: boolean;
  bidder: BidderDetail;
  audit: AuditEntry;
}

export interface VerificationListResponse {
  results: (Bidder & { tenderCode: string; tenderTitle: string })[];
}

export interface AuditResponse {
  entries: AuditEntry[];
}

// ---- Batch verification (Run Verification on a tender) ----
// The client runs POST /api/bidders/[id]/verify sequentially per pending bidder.

export const COMPLIANCE_CHECK_NAMES = [
  "GST Registration",
  "PAN Compliance",
  "Udyam / MSME",
  "EPFO Compliance",
  "ESIC Compliance",
  "Startup India (DPIIT)",
  "NSIC Registration",
  "Blacklist / Debarment",
] as const;

export type OfficerDecision = Recommendation;
