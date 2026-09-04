"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { bidderStatusLabel, timeAgo } from "@/lib/format";
import type { BidderStatus } from "@/lib/types";
import { PageHeader, FilterTabs } from "../page-header";
import { Reveal, Stagger, StaggerItem } from "../motion";
import { StatusPill } from "../status-pill";
import { RowListSkeleton } from "../skeletons";
import { EmptyState } from "../empty-state";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  company: string;
  contactName: string;
  tenderId: string;
  tenderCode: string;
  tenderTitle: string;
  status: BidderStatus;
  score: number | null;
  risk: string | null;
  lastCheckedAt: string | null;
};

type Filter = "ALL" | BidderStatus;

const TABS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
  { value: "MANUAL_REVIEW", label: "Manual review" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
];

export function VerificationView() {
  const navigate = useAppStore((s) => s.navigate);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (spin = false) => {
    if (spin) setRefreshing(true);
    setError(false);
    try {
      const r = await api.getVerificationResults();
      setRows(r.results as Row[]);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const countFor = (f: Filter) =>
    f === "ALL" ? rows?.length ?? 0 : rows?.filter((r) => r.status === f).length ?? 0;

  const shown = rows?.filter((r) => filter === "ALL" || r.status === filter) ?? [];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          <span className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Government database checks
          </span>
        }
        title={
          <>
            Verification <em className="text-primary">results</em>.
          </>
        }
        sub="Every bidder checked against GST, PAN, MSME, EPFO, ESIC and debarment registries."
        actions={
          <button
            onClick={() => load(true)}
            className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            <RefreshCw className={cn("size-3.5 text-muted-foreground", refreshing && "animate-spin")} />
            Refresh
          </button>
        }
      />

      <Reveal delay={0.08}>
        <FilterTabs
          id="verification-filter"
          value={filter}
          onChange={setFilter}
          tabs={TABS.map((t) => ({ ...t, count: countFor(t.value) }))}
        />
      </Reveal>

      {rows === null && !error && <RowListSkeleton rows={5} />}

      {error && (
        <p className="card-hairline p-6 text-center text-sm text-bad">
          Saved results could not be loaded.{" "}
          <button onClick={() => load()} className="font-medium underline underline-offset-4">
            Retry
          </button>
        </p>
      )}

      {rows !== null && shown.length === 0 && !error && (
        <EmptyState
          icon={BadgeCheck}
          title="No saved results here"
          hint="Run a verification from any tender to populate this view."
          action={
            <button
              onClick={() => navigate("tenders")}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Browse tenders
            </button>
          }
        />
      )}

      {rows !== null && shown.length > 0 && (
        <Stagger className="space-y-3">
          <AnimatePresence initial={false}>
            {shown.map((r) => (
              <StaggerItem key={r.id}>
                <motion.button
                  layout
                  onClick={() =>
                    navigate("bidder", {
                      bidderId: r.id,
                      bidderLabel: r.company,
                      tenderId: r.tenderId,
                      tenderLabel: r.tenderCode,
                    })
                  }
                  className="card-hairline card-hairline-hover group flex w-full flex-col gap-4 p-4 text-left sm:flex-row sm:items-center sm:gap-5"
                >
                  <span className="flex min-w-0 items-start gap-3.5 sm:flex-1 sm:items-center sm:gap-5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                      <Building2 className="size-5" strokeWidth={1.6} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium tracking-tight">
                        {r.company}
                      </span>
                      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="shrink-0 font-mono">{r.tenderCode}</span>
                        <span aria-hidden className="shrink-0">·</span>
                        <span className="min-w-0 truncate">{r.tenderTitle}</span>
                      </span>
                    </span>
                  </span>

                  <span className="flex items-center justify-between gap-4 sm:justify-end sm:gap-5">
                    <span className="text-right">
                      <span
                        className={cn(
                          "block text-xl font-semibold tabular-nums",
                          r.score !== null
                            ? r.score >= 80
                              ? "text-ok"
                              : r.score >= 60
                                ? "text-warn"
                                : "text-bad"
                            : "text-muted-foreground/40"
                        )}
                      >
                        {r.score ?? "—"}
                      </span>
                      <span className="block text-[10px] tracking-wide text-muted-foreground uppercase">
                        score
                      </span>
                    </span>
                    <span className="flex flex-col items-start gap-1 sm:items-end">
                      <StatusPill kind={r.status} />
                      <span className="text-[11px] text-muted-foreground">
                        {r.risk ? `${r.risk.toLowerCase()} risk · ` : ""}
                        {timeAgo(r.lastCheckedAt)}
                      </span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                  </span>
                </motion.button>
              </StaggerItem>
            ))}
          </AnimatePresence>
        </Stagger>
      )}

      {rows !== null && rows.length > 0 && (
        <Reveal>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            {bidderStatusLabel.VERIFIED} results are advisory — final decisions rest with the officer.
          </p>
        </Reveal>
      )}
    </div>
  );
}
