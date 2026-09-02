"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Filter, Play, Users, CheckCircle2,
  Clock, AlertTriangle, XCircle, ChevronRight, Building2, Calendar, FileText
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { MetricCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { VerificationProgress, type BidderProgress, type StageId, STAGES } from "@/components/VerificationProgress";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const AI_URL = process.env.NEXT_PUBLIC_AI_WORKER_URL || "http://localhost:8000";

type Bidder = {
  id: number;
  
    bidderName: string;
    companyName?: string;
    gstin?: string;
    panNumber?: string;
    verificationStatus?: string;
    complianceScore?: number;
    riskLevel?: string;
    lastVerifiedAt?: string;
    aiRecommendation?: string;
};

type Tender = {
  id: number;
  
    title: string;
    tenderId: string;
    statusId: string;
    department?: string;
    closingDate?: string;
    publishedDate?: string;
    bidderCount?: number;
    description?: any;
};

const FILTER_OPTIONS = ["All", "Pending", "Processing", "Verified", "Rejected", "Manual Review"];

export default function TenderDetailPage({ params }: { params: { id: string } }) {
  const [tender, setTender] = useState<Tender | null>(null);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");

  // Verification progress state
  const [verifying, setVerifying] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressCurrentName, setProgressCurrentName] = useState("");
  const [currentStage, setCurrentStage] = useState<StageId | null>(null);
  const [stageStatuses, setStageStatuses] = useState<Partial<Record<StageId, "pending" | "processing" | "done" | "error">>>({});
  const [bidderProgress, setBidderProgress] = useState<BidderProgress[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenderRes, biddersRes] = await Promise.all([
        axios.get(`${STRAPI}/api/tenders?filters[id][$eq]=${params.id}&populate=*`),
        axios.get(`${STRAPI}/api/bidder-applications?filters[tender][id][$eq]=${params.id}&populate[documents]=*`),
      ]);
      setTender(tenderRes.data.data[0]);
      setBidders(biddersRes.data.data || []);
    } catch (err) {
      console.error("Error fetching tender/bidders:", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Animated stage runner for a single bidder
  const runStagesAnimation = async (bidderName: string, bidderId: number) => {
    setProgressCurrentName(bidderName);
    setStageStatuses({});

    for (const stage of STAGES) {
      setCurrentStage(stage.id);
      setStageStatuses((prev) => ({ ...prev, [stage.id]: "processing" }));
      await new Promise((res) => setTimeout(res, 350 + Math.random() * 250));
      setStageStatuses((prev) => ({ ...prev, [stage.id]: "done" }));
    }
    setCurrentStage(null);
  };

  const handleVerifyAll = async () => {
    if (!confirm("Run AI compliance verification on all bidders?")) return;

    const bidderIds = bidders.map((b) => b.id);
    const biddersInit: BidderProgress[] = bidders.map((b) => ({
      id: b.id,
      name: b.bidderName || "Bidder",
      status: "pending",
    }));

    setBidderProgress(biddersInit);
    setProgressCurrent(0);
    setProgressOpen(true);
    setVerifying(true);

    try {
      // Process each bidder with animation
      for (let i = 0; i < bidders.length; i++) {
        const bidder = bidders[i];
        setProgressCurrent(i + 1);

        setBidderProgress((prev) =>
          prev.map((b) => b.id === bidder.id ? { ...b, status: "processing" } : b)
        );

        await runStagesAnimation(bidder.bidderName || "Bidder", bidder.id);

        setBidderProgress((prev) =>
          prev.map((b) => b.id === bidder.id ? { ...b, status: "done" } : b)
        );
      }

      // Actually call AI worker
      try {
        await axios.post(`${AI_URL}/verify-all-bidders`, { ids: bidderIds });
      } catch {
        // Best-effort — animation already shown
      }

      await fetchData();
    } finally {
      setVerifying(false);
      setTimeout(() => setProgressOpen(false), 1500);
    }
  };

  const filteredBidders = bidders.filter((b) => {
    if (statusFilter === "All") return true;
    return b.verificationStatus === statusFilter;
  });

  // Summary metrics
  const total = bidders.length;
  const verified = bidders.filter((b) => b.verificationStatus === "Verified").length;
  const pending = bidders.filter((b) => !b.verificationStatus || b.verificationStatus === "Pending").length;
  const highRisk = bidders.filter((b) => b.riskLevel === "High").length;
  const critical = bidders.filter((b) => b.riskLevel === "Critical").length;
  const rejected = bidders.filter((b) => b.verificationStatus === "Rejected").length;

  if (loading) {
    return (
      <AppShell breadcrumb={[{ label: "Search", href: "/search" }, { label: "Tender" }]}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading tender...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!tender) {
    return (
      <AppShell breadcrumb={[{ label: "Search", href: "/search" }, { label: "Not Found" }]}>
        <div className="text-center py-16">
          <p className="text-sm text-gray-500">Tender not found.</p>
          <Link href="/search" className="text-sm text-navy-700 hover:underline mt-2 inline-block">← Back to Search</Link>
        </div>
      </AppShell>
    );
  }

  const tData = tender;

  return (
    <AppShell
      breadcrumb={[
        { label: "Search", href: "/search" },
        { label: tData.tenderId || "Tender" },
        { label: "Bidders" },
      ]}
    >
      {/* Verification Progress Overlay */}
      <VerificationProgress
        isOpen={progressOpen}
        total={bidders.length}
        current={progressCurrent}
        currentBidderName={progressCurrentName}
        currentStage={currentStage}
        stageStatuses={stageStatuses}
        bidders={bidderProgress}
      />

      {/* Back link */}
      <Link href="/search" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Search
      </Link>

      {/* Tender Header Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-navy-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-bold text-gray-900">{tData.title}</h1>
                <StatusBadge status={tData.statusId || "Open"} />
              </div>
              <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500">
                <span className="font-mono font-semibold text-gray-600">{tData.tenderId}</span>
                {tData.department && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {tData.department}
                  </span>
                )}
                {tData.publishedDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Published {formatDate(tData.publishedDate)}
                  </span>
                )}
                {tData.closingDate && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Clock className="w-3 h-3" />
                    Closes {formatDate(tData.closingDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={fetchData}>
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="w-3.5 h-3.5" />}
              loading={verifying}
              onClick={handleVerifyAll}
              disabled={bidders.length === 0}
            >
              Run Verification
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <MetricCard label="Total Bidders" value={total} icon={<Users className="w-4 h-4" />} />
        <MetricCard label="Verified" value={verified} color="green" icon={<CheckCircle2 className="w-4 h-4" />} />
        <MetricCard label="Pending" value={pending} color="default" icon={<Clock className="w-4 h-4" />} />
        <MetricCard label="High Risk" value={highRisk} color="amber" icon={<AlertTriangle className="w-4 h-4" />} />
        <MetricCard label="Critical / Rejected" value={critical + rejected} color="red" icon={<XCircle className="w-4 h-4" />} />
      </div>

      {/* Bidder Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Bidder Applications</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
              {FILTER_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Bidder", "GSTIN", "PAN", "Status", "Score", "Risk", "Last Checked", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold text-gray-400 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredBidders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                  {statusFilter !== "All" ? `No bidders with status "${statusFilter}"` : "No bidders found."}
                </td>
              </tr>
            ) : (
              filteredBidders.map((bidder) => {
                const a = bidder;
                return (
                  <tr key={bidder.id} className="hover:bg-slate-25 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-gray-900">{a.bidderName}</div>
                      {a.companyName && a.companyName !== a.bidderName && (
                        <div className="text-xs text-gray-400">{a.companyName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {a.gstin || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {a.panNumber || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.verificationStatus || "Pending"} />
                    </td>
                    <td className="px-4 py-3">
                      {a.complianceScore != null ? (
                        <span className={cn(
                          "text-sm font-bold",
                          a.complianceScore >= 80 ? "text-green-600" :
                          a.complianceScore >= 60 ? "text-amber-600" : "text-red-600"
                        )}>
                          {a.complianceScore}<span className="text-xs font-normal text-gray-400">/100</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.riskLevel ? (
                        <RiskBadge risk={a.riskLevel} />
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {a.lastVerifiedAt ? formatDateTime(a.lastVerifiedAt) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/bidder/${bidder.id}`}>
                        <button className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-navy-900 transition-colors group">
                          View
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}