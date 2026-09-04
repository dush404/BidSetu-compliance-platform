"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Hourglass,
  IndianRupee,
  Play,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { BidderListItem, TenderDetail } from "@/lib/types";
import { bidderStatusLabel, fmtDate, fmtDateTime, daysUntil, initials } from "@/lib/format";
import { PageHeader, FilterTabs } from "../page-header";
import { Reveal, Stagger, StaggerItem } from "../motion";
import { StatusPill } from "../status-pill";
import { StatTile } from "../stat-tile";
import { DetailSkeleton } from "../skeletons";
import { EmptyState } from "../empty-state";
import { VerifyOverlay, type VerifyRun } from "../verify-overlay";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "PENDING" | "VERIFIED" | "MANUAL_REVIEW" | "REJECTED";

export function TenderDetailView({ tenderId }: { tenderId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const pushRecent = useAppStore((s) => s.pushRecent);
  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [runs, setRuns] = useState<VerifyRun[] | null>(null);

  const load = useCallback(
    async (spin = false) => {
      if (spin) setRefreshing(true);
      setError(false);
      try {
        const r = await api.getTender(tenderId);
        setTender(r.tender);
        pushRecent({ id: r.tender.id, code: r.tender.code, title: r.tender.title });
      } catch {
        setError(true);
      } finally {
        setRefreshing(false);
      }
    },
    [tenderId, pushRecent]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Tender unavailable"
        hint="We could not load this tender. It may have been removed."
        action={
          <button
            onClick={() => load()}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (!tender) return <DetailSkeleton />;

  const due = daysUntil(tender.closesAt);
  const soon = tender.status === "OPEN" && due <= 30;
  const pending = tender.bidders.filter(
    (b) => b.status === "PENDING" || b.status === "PROCESSING"
  );

  const counts: Record<Filter, number> = {
    ALL: tender.bidders.length,
    PENDING: pending.length,
    VERIFIED: tender.bidders.filter((b) => b.status === "VERIFIED").length,
    MANUAL_REVIEW: tender.bidders.filter((b) => b.status === "MANUAL_REVIEW").length,
    REJECTED: tender.bidders.filter((b) => b.status === "REJECTED").length,
  };

  const shown = tender.bidders.filter(
    (b) => filter === "ALL" || b.status === filter
  );

  const startBatch = () => {
    if (pending.length === 0) return;
    setRuns(pending.map((b) => ({ bidderId: b.id, company: b.company })));
  };

  return (
    <div className="space-y-7">
      <PageHeader
        onBack={tender.status ? () => navigate("tenders") : undefined}
        backLabel="All tenders"
        eyebrow={
          <>
            <span className="font-mono text-xs text-muted-foreground">{tender.code}</span>
            <StatusPill kind={tender.status} />
          </>
        }
        title={tender.title}
        sub={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5" /> {tender.department}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" /> Published {fmtDate(tender.publishedAt)}
            </span>
            <span className={cn("inline-flex items-center gap-1.5", soon && "font-medium text-warn")}>
              <Clock3 className="size-3.5" />
              {tender.status === "OPEN" ? `Closes ${fmtDate(tender.closesAt)}` : `Closed ${fmtDate(tender.closesAt)}`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IndianRupee className="size-3.5" /> {tender.value}
            </span>
          </span>
        }
        actions={
          <>
            <button
              onClick={() => load(true)}
              className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              <RefreshCw className={cn("size-3.5 text-muted-foreground", refreshing && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={startBatch}
              disabled={pending.length === 0 || runs !== null}
              className="group flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-primary-foreground transition-all hover:shadow-[0_8px_24px_-8px_oklch(0.245_0.014_105/0.4)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="size-3.5 transition-transform duration-300 group-hover:scale-110" />
              Run verification
              {pending.length > 0 && (
                <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[11px] tabular-nums">
                  {pending.length}
                </span>
              )}
            </button>
          </>
        }
      />

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total bidders" value={tender.stats.total} icon={Users} delay={0.02} />
        <StatTile label="Verified" value={tender.stats.verified} icon={CheckCircle2} tone="ok" delay={0.06} />
        <StatTile label="Pending" value={tender.stats.pending} icon={Hourglass} delay={0.1} />
        <StatTile label="High risk" value={tender.stats.highRisk} icon={AlertTriangle} tone="warn" delay={0.14} />
        <StatTile
          label="Critical / rejected"
          value={tender.stats.critical}
          icon={XCircle}
          tone="bad"
          delay={0.18}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* bidders */}
      <section aria-label="Bidder applications" className="space-y-4">
        <Reveal className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-2xl">Bidder applications</h2>
          <FilterTabs
            id="bidders-filter"
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: "ALL", label: "All", count: counts.ALL },
              { value: "PENDING", label: "Pending", count: counts.PENDING },
              { value: "VERIFIED", label: "Verified", count: counts.VERIFIED },
              { value: "MANUAL_REVIEW", label: "Manual review", count: counts.MANUAL_REVIEW },
              { value: "REJECTED", label: "Rejected", count: counts.REJECTED },
            ]}
          />
        </Reveal>

        {shown.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No bidders in this view"
            hint="Switch filters to see other applications."
          />
        ) : (
          <Stagger className="card-hairline divide-y divide-border overflow-hidden">
            <AnimatePresence initial={false}>
              {shown.map((b: BidderListItem) => (
                <StaggerItem key={b.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      navigate("bidder", {
                        bidderId: b.id,
                        bidderLabel: b.company,
                        tenderId: tender.id,
                        tenderLabel: tender.code,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        navigate("bidder", {
                          bidderId: b.id,
                          bidderLabel: b.company,
                          tenderId: tender.id,
                          tenderLabel: tender.code,
                        });
                    }}
                    className="group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/45 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_auto] sm:gap-4 sm:px-5"
                  >
                    {/* avatar */}
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-xs font-semibold text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                      {initials(b.contactName)}
                    </span>

                    {/* identity */}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{b.company}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {b.contactName}
                        <span className="hidden font-mono sm:inline"> · {b.gstin}</span>
                      </span>
                    </span>

                    {/* score + risk (desktop) */}
                    <span className="hidden items-center gap-4 sm:flex">
                      <span className="text-sm tabular-nums">
                        {b.score !== null ? (
                          <>
                            <span
                              className={cn(
                                "font-semibold",
                                b.score >= 80
                                  ? "text-ok"
                                  : b.score >= 60
                                    ? "text-warn"
                                    : "text-bad"
                              )}
                            >
                              {b.score}
                            </span>
                            <span className="text-xs text-muted-foreground">/100</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </span>
                      {b.risk ? (
                        <StatusPill kind={b.risk} size="xs" />
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </span>

                    {/* status */}
                    <StatusPill kind={b.status} />

                    {/* last checked */}
                    <span className="hidden w-24 text-right text-[11px] text-muted-foreground lg:block">
                      {b.lastCheckedAt ? fmtDateTime(b.lastCheckedAt).split(",")[0] : "Not checked"}
                    </span>

                    {/* actions */}
                    <span className="flex items-center gap-1.5">
                      {(b.status === "PENDING" || b.status === "PROCESSING") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRuns([{ bidderId: b.id, company: b.company }]);
                          }}
                          className="flex min-h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-accent/60 px-3 text-xs font-semibold text-accent-foreground transition-all hover:bg-accent"
                        >
                          <ShieldCheck className="size-3.5" />
                          Verify
                        </button>
                      )}
                      <span className="hidden size-9 items-center justify-center rounded-full text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-foreground sm:flex">
                        <ArrowUpRight className="size-4" />
                      </span>
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </AnimatePresence>
          </Stagger>
        )}

        <Reveal delay={0.05}>
          <p className="text-center text-xs text-muted-foreground">
            {tender.stats.verified} verified · {counts.PENDING} pending · verification checks GST, PAN,
            MSME, EPFO, ESIC & debarment registries
          </p>
        </Reveal>
      </section>

      {/* batch / single verification overlay */}
      <AnimatePresence>
        {runs && (
          <VerifyOverlay
            key={runs.map((r) => r.bidderId).join(",")}
            runs={runs}
            onAllDone={(results) => {
              setRuns(null);
              void load();
              const q = results.filter((r) => r.recommendation === "QUALIFY").length;
              const bad = results.filter(
                (r) => r.recommendation === "DISQUALIFY"
              ).length;
              toast.success(
                results.length === 1
                  ? "Verification complete"
                  : `${results.length} bidders verified`,
                {
                  description: `${q} recommend qualify · ${bad} recommend disqualify · audit trail updated`,
                }
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
