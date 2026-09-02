"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Clock, CheckCircle2, XCircle, AlertTriangle, Database, User, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { cn, formatDateTime } from "@/lib/utils";

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

type LogEntry = {
  id: number;
  action: string;
  timestamp: string;
  aiSource?: string;
  riskLevel?: string;
  complianceScore?: number;
  detailsLog?: any;
  bidder?: { bidderName: string; companyName?: string };
};

function getActionIcon(action: string) {
  if (action?.toLowerCase().includes("qualif")) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (action?.toLowerCase().includes("disqualif") || action?.toLowerCase().includes("reject")) return <XCircle className="w-4 h-4 text-red-500" />;
  if (action?.toLowerCase().includes("review")) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  if (action?.toLowerCase().includes("gst") || action?.toLowerCase().includes("pan")) return <Database className="w-4 h-4 text-blue-500" />;
  if (action?.toLowerCase().includes("officer")) return <User className="w-4 h-4 text-purple-500" />;
  return <Clock className="w-4 h-4 text-gray-400" />;
}

function getActionColor(action: string) {
  if (action?.toLowerCase().includes("qualif")) return "text-green-700 bg-green-50 border-green-200";
  if (action?.toLowerCase().includes("disqualif") || action?.toLowerCase().includes("reject")) return "text-red-700 bg-red-50 border-red-200";
  if (action?.toLowerCase().includes("review")) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-blue-700 bg-blue-50 border-blue-200";
}

// Demo audit events (shown when no real logs exist yet)
const DEMO_EVENTS = [
  { id: 1, action: "Verification initiated", time: "10:42:12", actor: "System", source: "AI Worker", result: "Started" },
  { id: 2, action: "GST record retrieved", time: "10:42:16", actor: "System", source: "GSTN (Simulated)", result: "Active" },
  { id: 3, action: "PAN verified", time: "10:42:18", actor: "System", source: "Income Tax (Simulated)", result: "Valid" },
  { id: 4, action: "Udyam verified", time: "10:42:20", actor: "System", source: "MSME (Simulated)", result: "Active" },
  { id: 5, action: "Document discrepancy detected", time: "10:42:23", actor: "System", source: "AI Engine", result: "Warning" },
  { id: 6, action: "Compliance score calculated", time: "10:42:26", actor: "System", source: "Rule Engine", result: "82/100" },
  { id: 7, action: "AI recommendation generated", time: "10:42:29", actor: "Gemini Flash", source: "AI Worker", result: "Manual Review" },
  { id: 8, action: "Officer reviewed result", time: "10:45:02", actor: "Procurement Officer", source: "Platform", result: "Reviewed" },
  { id: 9, action: "Bidder qualified", time: "10:46:12", actor: "Procurement Officer", source: "Platform", result: "Qualified" },
];

export default function AuditPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [useDemoData, setUseDemoData] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${STRAPI}/api/verification-logs?populate[bidder]=*&sort=timestamp:desc&pagination[limit]=50`
      );
      const data = res.data.data || [];
      setLogs(data);
      if (data.length === 0) setUseDemoData(true);
    } catch {
      setUseDemoData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <AppShell title="Audit Logs" breadcrumb={[{ label: "Audit Logs" }]}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Verification Audit Trail</h1>
            <p className="text-xs text-gray-500 mt-0.5">All verification events are recorded chronologically</p>
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {useDemoData && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            ⚡ Showing demo audit events. Real events will appear here after running verifications.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

            <div className="space-y-0">
              {useDemoData
                ? DEMO_EVENTS.map((event, i) => (
                  <div key={event.id} className={cn("relative flex gap-4 pl-12 pb-5", i === DEMO_EVENTS.length - 1 && "pb-0")}>
                    {/* Dot */}
                    <div className="absolute left-3.5 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-navy-400 z-10" />

                    <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-card p-4 animate-fade-in">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-navy-700">{event.time}</span>
                          <div className={cn("text-xs font-semibold px-2 py-0.5 rounded border", getActionColor(event.action))}>
                            {event.action}
                          </div>
                        </div>
                        <span className="text-2xs text-gray-400 flex-shrink-0">{event.result}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-2xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {event.actor}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" /> {event.source}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
                : logs.map((log, i) => {
                  const la = log;
                  const bidderName = la.bidder?.bidderName;
                  return (
                    <div key={log.id} className={cn("relative flex gap-4 pl-12 pb-5", i === logs.length - 1 && "pb-0")}>
                      <div className="absolute left-3.5 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-navy-400 z-10" />
                      <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-card p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-navy-700">
                              {la.timestamp ? new Date(la.timestamp).toLocaleTimeString("en-IN") : "—"}
                            </span>
                            <div className={cn("text-xs font-semibold px-2 py-0.5 rounded border", getActionColor(la.action))}>
                              {la.action}
                            </div>
                          </div>
                          {la.complianceScore != null && (
                            <span className="text-2xs text-gray-400">{la.complianceScore}/100</span>
                          )}
                        </div>
                        {bidderName && (
                          <div className="mt-2 text-2xs text-gray-500">
                            Bidder: <span className="font-semibold text-gray-700">{bidderName}</span>
                          </div>
                        )}
                        <div className="mt-1 text-2xs text-gray-400">
                          {formatDateTime(la.timestamp)} · {la.aiSource || "System"}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
