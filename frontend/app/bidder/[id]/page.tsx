"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, MinusCircle,
  Shield, Brain, FileText, Clock, Database, ExternalLink,
  ChevronDown, ChevronUp, Info
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { ScoreIndicator } from "@/components/ui/ScoreIndicator";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import DocumentViewer from "@/components/DocumentViewer";
import { cn, formatDateTime } from "@/lib/utils";

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

type CheckStatus = "PASS" | "FAIL" | "REVIEW" | "SKIPPED" | "NOT_APPLICABLE";

interface CheckDetail {
  status: CheckStatus;
  submitted?: Record<string, any>;
  verified?: Record<string, any>;
  reason?: string;
  source?: string;
  checkedAt?: string;
}

interface VerificationResult {
  bidderId?: string;
  overallScore?: number;
  riskLevel?: string;
  recommendation?: string;
  checks?: {
    gst?: CheckDetail;
    pan?: CheckDetail;
    udyam?: CheckDetail;
    epfo?: CheckDetail;
    esic?: CheckDetail;
    startupIndia?: CheckDetail;
    nsic?: CheckDetail;
    blacklist?: CheckDetail;
  };
  discrepancies?: Array<{ field: string; submitted: string; verified: string; severity: string }>;
  evidence?: any[];
  verifiedAt?: string;
  aiSummary?: string;
  confidence?: number;
  verificationMode?: string;
}

type Bidder = {
  id: number;
  attributes: {
    bidderName: string;
    companyName?: string;
    gstin?: string;
    panNumber?: string;
    udyamId?: string;
    epfoCode?: string;
    esicCode?: string;
    dpiitNumber?: string;
    nsicNumber?: string;
    verificationStatus?: string;
    complianceScore?: number;
    riskLevel?: string;
    aiRecommendation?: string;
    lastVerifiedAt?: string;
    verificationResult?: VerificationResult | string;
    documents?: { data: any[] };
    tender?: { data: { id: number; attributes: { title: string; tenderId: string } } };
};

const CHECK_META: Record<string, { label: string; source: string; icon: React.ReactNode }> = {
  gst: { label: "GST Registration", source: "GSTN (Simulated)", icon: <Database className="w-3.5 h-3.5" /> },
  pan: { label: "PAN Compliance", source: "Income Tax Dept. (Simulated)", icon: <Database className="w-3.5 h-3.5" /> },
  udyam: { label: "Udyam / MSME", source: "MSME Ministry (Simulated)", icon: <Database className="w-3.5 h-3.5" /> },
  epfo: { label: "EPFO Compliance", source: "EPFO (Simulated)", icon: <Database className="w-3.5 h-3.5" /> },
  esic: { label: "ESIC Compliance", source: "ESIC (Simulated)", icon: <Database className="w-3.5 h-3.5" /> },
  startupIndia: { label: "Startup India (DPIIT)", source: "DPIIT (Simulated)", icon: <Database className="w-3.5 h-3.5" /> },
  nsic: { label: "NSIC Registration", source: "NSIC (Simulated)", icon: <Database className="w-3.5 h-3.5" /> },
  blacklist: { label: "Blacklist / Debarment", source: "Central Registry (Simulated)", icon: <Database className="w-3.5 h-3.5" /> },
};

function getCheckIcon(status: CheckStatus) {
  switch (status) {
    case "PASS": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "FAIL": return <XCircle className="w-4 h-4 text-red-500" />;
    case "REVIEW": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "SKIPPED": return <MinusCircle className="w-4 h-4 text-gray-300" />;
    case "NOT_APPLICABLE": return <MinusCircle className="w-4 h-4 text-gray-300" />;
    default: return <MinusCircle className="w-4 h-4 text-gray-300" />;
  }
}

function getCheckBg(status: CheckStatus) {
  switch (status) {
    case "PASS": return "bg-green-50 border-green-100";
    case "FAIL": return "bg-red-50 border-red-100";
    case "REVIEW": return "bg-amber-50 border-amber-100";
    default: return "bg-gray-50 border-gray-100";
  }
}

export default function BidderDetailPage({ params }: { params: { id: string } }) {
  const [bidder, setBidder] = useState<Bidder | null>(null);
  const [loading, setLoading] = useState(true);
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBidder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${STRAPI}/api/bidder-applications?filters[id][$eq]=${params.id}&populate[documents]=*&populate[tender][populate][0]=*`
      );
      setBidder(res.data.data[0]);
    } catch (err) {
      console.error("Error fetching bidder:", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchBidder();
  }, [fetchBidder]);

  const handleDecision = async (status: "Verified" | "Rejected" | "Manual Review", reason?: string) => {
    setActionLoading(true);
    try {
      await axios.patch(`${STRAPI}/api/bidder-applications/${params.id}`, {
        data: { verificationStatus: status },
      });
      await fetchBidder();
      setShowDisqualifyModal(false);
    } catch (err) {
      console.error("Decision error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumb={[{ label: "Tenders" }, { label: "Bidder" }]}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading bidder dashboard...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!bidder) {
    return (
      <AppShell>
        <div className="text-center py-16">
          <p className="text-sm text-gray-500">Bidder not found.</p>
        </div>
      </AppShell>
    );
  }

  const a = bidder;
  const score = a.complianceScore ?? 0;
  const risk = a.riskLevel || "Unknown";
  const status = a.verificationStatus || "Pending";
  const tender = a.tender;
  const tenderId = a.tender?.data?.id;

  // Parse verificationResult
  let vr: VerificationResult = {};
  if (a.verificationResult) {
    try {
      vr = typeof a.verificationResult === "string"
        ? JSON.parse(a.verificationResult)
        : a.verificationResult;
    } catch { vr = {}; }
  }

  const checks = vr.checks || {};
  const checkKeys = Object.keys(CHECK_META);

  // Build checklist from verificationResult.checks OR fallback from attributes
  const checklistItems = checkKeys.map((key) => {
    const check = checks[key as keyof typeof checks];
    const meta = CHECK_META[key];

    // Fallback statuses if no verificationResult
    let fallbackStatus: CheckStatus = "SKIPPED";
    if (!check) {
      if (key === "gst" && a.gstin) fallbackStatus = "SKIPPED";
      if (key === "blacklist") fallbackStatus = "SKIPPED";
    }

    return {
      key,
      label: meta.label,
      source: meta.source,
      status: check?.status ?? fallbackStatus,
      reason: check?.reason,
      submitted: check?.submitted,
      verified: check?.verified,
      checkedAt: check?.checkedAt || a.lastVerifiedAt,
    };
  });

  const passCount = checklistItems.filter((c) => c.status === "PASS").length;
  const failCount = checklistItems.filter((c) => c.status === "FAIL").length;
  const reviewCount = checklistItems.filter((c) => c.status === "REVIEW").length;

  const recommendation = vr.recommendation || (score >= 80 ? "QUALIFY" : score >= 60 ? "MANUAL_REVIEW" : "DISQUALIFY");
  const recColor = recommendation === "QUALIFY" ? "text-green-700" : recommendation === "MANUAL_REVIEW" ? "text-amber-700" : "text-red-700";
  const recBg = recommendation === "QUALIFY" ? "bg-green-50 border-green-200" : recommendation === "MANUAL_REVIEW" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  const whyPoints = [
    ...(checklistItems.filter((c) => c.status === "PASS").map((c) => ({ pass: true, text: `${c.label} — verified and active` }))),
    ...(checklistItems.filter((c) => c.status === "FAIL").map((c) => ({ pass: false, text: `${c.label} — ${c.reason || "failed verification"}` }))),
    ...(checklistItems.filter((c) => c.status === "REVIEW").map((c) => ({ pass: null, text: `${c.label} — requires manual review` }))),
  ];

  return (
    <AppShell
      breadcrumb={[
        { label: "Search", href: "/search" },
        tender ? { label: tender.tenderId, href: tenderId ? `/tender/${tenderId}` : "/search" } : { label: "Tender" },
        { label: a.bidderName || "Bidder" },
      ]}
    >
      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={docViewerOpen}
        onClose={() => setDocViewerOpen(false)}
        doc={selectedDoc}
        verificationResult={vr}
      />

      {/* Disqualify Confirmation Dialog */}
      {showDisqualifyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-elevated w-full max-w-md animate-slide-up">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Disqualify this bidder?</h3>
                  <p className="text-xs text-gray-500">This action will be logged in the audit trail</p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm">
                <div className="font-semibold text-gray-800">{a.bidderName}</div>
                <div className="text-xs text-gray-500 mt-1">Score: {score}/100 · Risk: {risk}</div>
                {failCount > 0 && (
                  <div className="text-xs text-red-600 mt-1">{failCount} check(s) failed</div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Reason for Disqualification
                </label>
                <textarea
                  value={disqualifyReason}
                  onChange={(e) => setDisqualifyReason(e.target.value)}
                  rows={3}
                  className="input-base resize-none"
                  placeholder="Provide the reason for disqualification..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowDisqualifyModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  loading={actionLoading}
                  onClick={() => handleDecision("Rejected", disqualifyReason)}
                >
                  Confirm Disqualification
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back navigation */}
      {tenderId && (
        <Link href={`/tender/${tenderId}`} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Tender
        </Link>
      )}

      {/* ── BIDDER HEADER ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">
                {a.companyName || a.bidderName}
              </h1>
              <StatusBadge status={status} />
            </div>
            {a.companyName && a.companyName !== a.bidderName && (
              <p className="text-sm text-gray-500 mb-1">Contact: {a.bidderName}</p>
            )}
            <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500 mt-1.5">
              {a.gstin && (
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                  GSTIN: {a.gstin}
                </span>
              )}
              {a.panNumber && (
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                  PAN: {a.panNumber}
                </span>
              )}
              {tender && (
                <span className="text-gray-400">Tender: {tender.title}</span>
              )}
              {a.lastVerifiedAt && (
                <span className="flex items-center gap-1 text-gray-400">
                  <Clock className="w-3 h-3" />
                  Verified {formatDateTime(a.lastVerifiedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Demo badge */}
          <div className="text-right flex-shrink-0">
            <div className="text-2xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              ⚡ Simulated DB
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* ── LEFT COLUMN (2/3) ── */}
        <div className="col-span-2 space-y-5">

          {/* Score + Summary */}
          <div className="grid grid-cols-3 gap-4">
            {/* Score card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5 flex flex-col items-center gap-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Compliance Score</div>
              <ScoreIndicator score={score} size="lg" />
            </div>

            {/* Risk + Recommendation */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-card p-5">
              <div className="grid grid-cols-2 gap-4 h-full">
                <div>
                  <div className="section-label mb-2">Risk Level</div>
                  <div className="flex items-center gap-2 mt-1">
                    <RiskBadge risk={risk} />
                  </div>
                  <div className="mt-4">
                    <div className="section-label mb-2">Summary</div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-green-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {passCount} Pass
                      </span>
                      <span className="flex items-center gap-1 text-red-600 font-semibold">
                        <XCircle className="w-3.5 h-3.5" /> {failCount} Fail
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> {reviewCount} Review
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="section-label mb-2">Recommendation</div>
                  <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-bold mt-1", recBg, recColor)}>
                    <Shield className="w-4 h-4" />
                    {recommendation?.replace(/_/g, " ")}
                  </div>
                  {vr.verifiedAt && (
                    <div className="text-2xs text-gray-400 mt-3 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(vr.verifiedAt)}
                    </div>
                  )}
                  {vr.verificationMode && (
                    <div className="text-2xs text-gray-400 mt-1">Mode: {vr.verificationMode}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Verification Checklist */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-navy-700" />
              <h2 className="text-sm font-semibold text-gray-900">Compliance Checklist</h2>
            </div>

            <div className="divide-y divide-gray-50">
              {checklistItems.map((item) => {
                const isExpanded = expandedCheck === item.key;
                return (
                  <div key={item.key}>
                    <button
                      onClick={() => setExpandedCheck(isExpanded ? null : item.key)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                    >
                      <div className="flex-shrink-0">{getCheckIcon(item.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{item.label}</span>
                          {item.status !== "SKIPPED" && item.status !== "NOT_APPLICABLE" && (
                            <span className={cn(
                              "text-2xs font-semibold px-1.5 py-0.5 rounded",
                              item.status === "PASS" ? "bg-green-100 text-green-700" :
                              item.status === "FAIL" ? "bg-red-100 text-red-700" :
                              "bg-amber-100 text-amber-700"
                            )}>
                              {item.status}
                            </span>
                          )}
                        </div>
                        {item.reason && !isExpanded && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{item.reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-2xs text-gray-400 hidden sm:block">{item.source}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className={cn("mx-4 mb-3 rounded-xl border p-4 animate-fade-in", getCheckBg(item.status))}>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {item.submitted && Object.keys(item.submitted).length > 0 && (
                            <div>
                              <div className="section-label mb-2">Submitted</div>
                              {Object.entries(item.submitted).map(([k, v]) => (
                                <div key={k} className="flex gap-2 mb-1">
                                  <span className="text-gray-500 capitalize">{k}:</span>
                                  <span className="font-mono font-semibold text-gray-800">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {item.verified && Object.keys(item.verified).length > 0 && (
                            <div>
                              <div className="section-label mb-2">Verified (Database)</div>
                              {Object.entries(item.verified).map(([k, v]) => (
                                <div key={k} className="flex gap-2 mb-1">
                                  <span className="text-gray-500 capitalize">{k}:</span>
                                  <span className="font-mono font-semibold text-gray-800">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {item.reason && (
                          <div className="mt-3 pt-3 border-t border-current/10">
                            <div className="section-label mb-1">Finding</div>
                            <p className="text-xs text-gray-700">{item.reason}</p>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-2xs text-gray-400">
                          <Database className="w-3 h-3" />
                          Source: {item.source}
                          {item.checkedAt && (
                            <><span>·</span><Clock className="w-3 h-3" />{formatDateTime(item.checkedAt)}</>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-navy-700" />
              <h2 className="text-sm font-semibold text-gray-900">Uploaded Documents</h2>
            </div>
            <div className="p-4 space-y-2">
              {(!a.documents?.data || a.documents.data.length === 0) ? (
                <div className="text-center py-8">
                  <FileText className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No documents uploaded</p>
                </div>
              ) : (
                a.documents.data.map((doc: any) => {
                  const isPdf = doc.mime?.includes("pdf") || doc.ext === ".pdf";
                  return (
                    <button
                      key={doc.id}
                      onClick={() => { setSelectedDoc(doc); setDocViewerOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-navy-200 hover:bg-navy-50/30 transition-all group text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-navy-100">
                        <FileText className="w-4 h-4 text-gray-500 group-hover:text-navy-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{doc.name}</div>
                        <div className="text-xs text-gray-400">{isPdf ? "PDF" : "Image"} · Click to view</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-navy-500 flex-shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (1/3) ── */}
        <div className="col-span-1 space-y-5">

          {/* AI Recommendation Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              <h2 className="text-sm font-semibold text-gray-900">AI Verification Summary</h2>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-600 leading-relaxed mb-4">
                {vr.aiSummary || a.aiRecommendation ||
                  (score >= 80
                    ? "Most mandatory compliance requirements are satisfied. The bidder's submitted documents align with government database records."
                    : score >= 60
                    ? "Some compliance requirements require manual review. Specific discrepancies have been identified and should be investigated."
                    : "Multiple compliance checks have failed. Significant discrepancies detected. Manual review strongly recommended before proceeding."
                  )}
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Recommendation</span>
                  <span className={cn("font-bold", recColor)}>
                    {recommendation?.replace(/_/g, " ")}
                  </span>
                </div>
                {vr.confidence != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Confidence</span>
                    <span className="font-semibold text-gray-800">{vr.confidence}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Data Source</span>
                  <span className="font-semibold text-gray-600">Simulated Gov. DB</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2 bg-blue-50 rounded-lg p-2.5">
                <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-2xs text-blue-700 leading-relaxed">
                  AI is a <strong>decision support tool only</strong>. The final qualification or disqualification decision rests with the Procurement Officer.
                </p>
              </div>
            </div>
          </div>

          {/* Why this result */}
          {whyPoints.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Why this result?</h2>
              </div>
              <div className="p-4 space-y-2">
                {whyPoints.slice(0, 8).map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {p.pass === true && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />}
                    {p.pass === false && <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
                    {p.pass === null && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />}
                    <span className={cn(
                      "leading-relaxed",
                      p.pass === true ? "text-gray-600" : p.pass === false ? "text-gray-800 font-medium" : "text-gray-700"
                    )}>
                      {p.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discrepancies */}
          {vr.discrepancies && vr.discrepancies.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-semibold text-gray-900">Discrepancies ({vr.discrepancies.length})</h2>
              </div>
              <div className="p-4 space-y-3">
                {vr.discrepancies.map((d, i) => (
                  <div key={i} className="text-xs border border-red-100 rounded-lg p-3 bg-red-50">
                    <div className="font-semibold text-red-700 capitalize mb-1.5">{d.field}</div>
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-16 flex-shrink-0">Submitted:</span>
                        <span className="font-mono text-gray-800">{d.submitted}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-16 flex-shrink-0">Verified:</span>
                        <span className="font-mono text-gray-800">{d.verified}</span>
                      </div>
                    </div>
                    <div className={cn(
                      "mt-2 text-2xs font-semibold uppercase",
                      d.severity === "HIGH" || d.severity === "CRITICAL" ? "text-red-600" : "text-amber-600"
                    )}>
                      Severity: {d.severity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Panel */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Officer Decision</h2>
              <p className="text-2xs text-gray-400 mt-0.5">Your decision is final and will be logged</p>
            </div>
            <div className="p-4 space-y-2">
              {/* Summary before decision */}
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-3 space-y-1">
                <div className="flex justify-between">
                  <span>Compliance Score</span>
                  <span className="font-semibold text-gray-800">{score}/100</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Level</span>
                  <span className={cn("font-semibold", risk === "Low" ? "text-green-700" : risk === "Critical" ? "text-red-700" : "text-amber-700")}>{risk}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed Checks</span>
                  <span className={cn("font-semibold", failCount > 0 ? "text-red-600" : "text-green-600")}>{failCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>AI Suggests</span>
                  <span className={cn("font-semibold", recColor)}>{recommendation?.replace(/_/g, " ")}</span>
                </div>
              </div>

              <Button
                variant="success"
                size="md"
                className="w-full"
                icon={<CheckCircle2 className="w-4 h-4" />}
                loading={actionLoading && status !== "Rejected"}
                onClick={() => handleDecision("Verified")}
              >
                Qualify Bidder
              </Button>
              <Button
                variant="warning"
                size="md"
                className="w-full"
                icon={<AlertTriangle className="w-4 h-4" />}
                onClick={() => handleDecision("Manual Review")}
              >
                Request Clarification
              </Button>
              <Button
                variant="destructive"
                size="md"
                className="w-full"
                icon={<XCircle className="w-4 h-4" />}
                onClick={() => setShowDisqualifyModal(true)}
              >
                Disqualify Bidder
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
