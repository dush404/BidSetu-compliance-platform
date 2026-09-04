// ============================================================
// AI Worker client + result mapper
// ------------------------------------------------------------
// Bridges the redesigned frontend to the user's Python AI worker
// (mini-services/ai-worker, FastAPI on :3010). The worker's raw
// result shape (verification_pipeline.run_verification) is mapped
// onto the app's VerificationOutcome contract so persistence and
// UI stay unchanged.
// ============================================================

import type { CheckStatus, RiskLevel, Recommendation } from "./types";
import { COMPLIANCE_CHECK_NAMES } from "./types";
import type { VerificationOutcome, VerificationCheckResult } from "./verification";

export const AI_WORKER_URL =
  process.env.AI_WORKER_URL ?? "http://localhost:3010";

export const WORKER_MODEL_LABEL = "AI Worker · Gemini 3.6 Flash";

// ---- raw worker result shapes (mirrors verification_pipeline.py) ----

interface WorkerCheck {
  status: "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";
  reason: string;
  submitted?: Record<string, unknown>;
  verified?: Record<string, unknown>;
  source?: string;
  severity?: string;
  checkedAt?: string;
}

export interface WorkerVerificationResult {
  bidderId: string;
  companyName?: string;
  overallScore?: number;
  riskLevel?: string;
  recommendation?: "QUALIFY" | "MANUAL_REVIEW" | "DISQUALIFY";
  checks?: Record<string, WorkerCheck>;
  discrepancies?: {
    field: string;
    submitted: string;
    verified: string;
    severity: string;
  }[];
  aiSummary?: string;
  aiSource?: string;
  confidence?: number;
  verifiedAt?: string;
  verificationMode?: string;
  error?: string;
}

const CHECK_KEY_TO_NAME: Record<string, string> = {
  gst: "GST Registration",
  pan: "PAN Compliance",
  udyam: "Udyam / MSME",
  epfo: "EPFO Compliance",
  esic: "ESIC Compliance",
  startupIndia: "Startup India (DPIIT)",
  nsic: "NSIC Registration",
  blacklist: "Blacklist / Debarment",
};

function normalizeStatus(status: WorkerCheck["status"]): CheckStatus {
  if (status === "NOT_APPLICABLE") return "NA";
  return status;
}

function normalizeRisk(risk: string | undefined): RiskLevel {
  switch ((risk ?? "").toLowerCase()) {
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
      return "HIGH";
    default:
      return "CRITICAL";
  }
}

function normalizeRecommendation(rec: string | undefined): Recommendation {
  // The worker's rule engine emits MANUAL_REVIEW; the app contract calls it CLARIFY.
  if (rec === "MANUAL_REVIEW") return "CLARIFY";
  if (rec === "DISQUALIFY") return "DISQUALIFY";
  return "QUALIFY";
}

function evidenceLine(record: Record<string, unknown> | undefined): string {
  if (!record) return "";
  const entries = Object.entries(record)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return entries.length ? entries.join(" · ") : "";
}

/** Pick the most meaningful "verified value" badge for a check. */
function pickVerifiedValue(key: string, check: WorkerCheck): string | undefined {
  const verified = check.verified ?? {};
  if (key === "blacklist") {
    if ("blacklisted" in verified) return `Blacklisted: ${String(verified.blacklisted)}`;
    if (check.status === "FAIL") return "Blacklisted: true";
    return "Blacklisted: false";
  }
  const status = verified.status;
  if (status) return `Status: ${String(status)}`;
  const first = Object.entries(verified)[0];
  return first ? `${first[0]}: ${String(first[1])}` : undefined;
}

/** Short line for the row; full reason + evidence for the accordion. */
function splitReason(reason: string): { detail: string; finding: string } {
  const trimmed = reason.trim();
  if (trimmed.length <= 90) {
    return { detail: trimmed, finding: trimmed };
  }
  const firstSentence = trimmed.split(/(?<=\.)\s+/)[0] ?? trimmed;
  return { detail: firstSentence, finding: trimmed };
}

export function mapWorkerResult(
  result: WorkerVerificationResult
): VerificationOutcome {
  const checksByKey = result.checks ?? {};

  const checks: VerificationCheckResult[] = COMPLIANCE_CHECK_NAMES.map((name) => {
    const key = Object.keys(CHECK_KEY_TO_NAME).find(
      (k) => CHECK_KEY_TO_NAME[k] === name
    ) as string;
    const check = checksByKey[key];
    const source = check?.source ?? "Central Registry (Simulated)";

    if (!check) {
      return {
        name,
        status: "NA" as CheckStatus,
        detail: "Check not returned by the AI worker.",
        finding: "This check was not part of the worker response.",
        source,
      };
    }

    const status = normalizeStatus(check.status);
    const { detail, finding } = splitReason(check.reason ?? "");
    const submitted = evidenceLine(check.submitted);
    const verified = evidenceLine(check.verified);
    const findingFull = [finding, submitted && `Submitted — ${submitted}`, verified && `Verified — ${verified}`]
      .filter(Boolean)
      .join("\n\n");

    return {
      name,
      status,
      detail,
      finding: findingFull,
      source,
      verifiedValue: pickVerifiedValue(key, check),
    };
  });

  const failedChecks = checks.filter((c) => c.status === "FAIL").length;

  return {
    status:
      result.recommendation === "QUALIFY"
        ? "VERIFIED"
        : result.recommendation === "DISQUALIFY"
          ? "REJECTED"
          : "MANUAL_REVIEW",
    score: typeof result.overallScore === "number" ? result.overallScore : 0,
    risk: normalizeRisk(result.riskLevel),
    recommendation: normalizeRecommendation(result.recommendation),
    aiSummary:
      result.aiSummary ??
      "The AI worker did not return a summary for this verification.",
    aiSource: result.aiSource,
    confidence: typeof result.confidence === "number" ? result.confidence : 0,
    lastCheckedAt: result.verifiedAt ? new Date(result.verifiedAt) : new Date(),
    dataSource: result.verificationMode ?? "SIMULATED_GOV_DATABASE",
    failedChecks,
    checks,
  };
}

/**
 * Run the full verification through the Python AI worker.
 * Resolves with a mapped VerificationOutcome, rejects if the worker
 * is unreachable, errors out, or reports a failure for this bidder.
 */
export async function runAiWorkerVerification(
  bidderId: string
): Promise<VerificationOutcome> {
  const candidateUrls = Array.from(
    new Set(
      [
        process.env.AI_WORKER_URL,
        "http://localhost:8000",
        "http://localhost:3010",
      ].filter(Boolean) as string[]
    )
  );

  let lastError: Error | null = null;
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/verify-bidder/${bidderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(90000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AI worker responded ${res.status}: ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as WorkerVerificationResult;
      if (data.error) {
        throw new Error(`AI worker error: ${data.error}`);
      }
      if (!data.checks || typeof data.checks !== "object") {
        throw new Error("AI worker returned no checks payload");
      }
      return mapWorkerResult(data);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("All AI worker candidate endpoints failed");
}
