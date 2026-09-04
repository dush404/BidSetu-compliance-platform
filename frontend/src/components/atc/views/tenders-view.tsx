"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Clock3,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { Tender } from "@/lib/types";
import { fmtDate, daysUntil } from "@/lib/format";
import { PageHeader, FilterTabs } from "../page-header";
import { Reveal, Stagger, StaggerItem } from "../motion";
import { StatusPill } from "../status-pill";
import { RowListSkeleton } from "../skeletons";
import { EmptyState } from "../empty-state";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "OPEN" | "CLOSED";

export function TendersView() {
  const navigate = useAppStore((s) => s.navigate);
  const pushRecent = useAppStore((s) => s.pushRecent);
  const [tenders, setTenders] = useState<Tender[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (spin = false) => {
    if (spin) setRefreshing(true);
    setError(false);
    try {
      const r = await api.getTenders();
      setTenders(r.tenders);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = {
    ALL: tenders?.length ?? 0,
    OPEN: tenders?.filter((t) => t.status === "OPEN").length ?? 0,
    CLOSED: tenders?.filter((t) => t.status === "CLOSED").length ?? 0,
  };

  const shown =
    tenders?.filter((t) => filter === "ALL" || t.status === filter) ?? [];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          <span className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Procurement pipeline
          </span>
        }
        title={
          <>
            All <em className="text-primary">tenders</em>.
          </>
        }
        sub="Open a tender to review its bidders, run verification and record decisions."
        actions={
          <button
            onClick={() => load(true)}
            className="group flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            <RefreshCw
              className={cn(
                "size-3.5 text-muted-foreground transition-transform duration-500",
                refreshing && "animate-spin"
              )}
            />
            Refresh
          </button>
        }
      />

      <Reveal delay={0.1}>
        <FilterTabs
          id="tenders-filter"
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: "ALL", label: "All", count: counts.ALL },
            { value: "OPEN", label: "Open", count: counts.OPEN },
            { value: "CLOSED", label: "Closed", count: counts.CLOSED },
          ]}
        />
      </Reveal>

      {tenders === null && !error && <RowListSkeleton rows={5} />}

      {error && (
        <p className="card-hairline p-6 text-center text-sm text-bad">
          Could not load tenders.{" "}
          <button onClick={() => load()} className="font-medium underline underline-offset-4">
            Retry
          </button>
        </p>
      )}

      {tenders !== null && shown.length === 0 && !error && (
        <EmptyState icon={FileText} title="Nothing here" hint="No tenders match this filter." />
      )}

      {tenders !== null && shown.length > 0 && (
        <Stagger className="space-y-3">
          <AnimatePresence initial={false}>
            {shown.map((t) => {
              const due = daysUntil(t.closesAt);
              const soon = t.status === "OPEN" && due <= 30;
              return (
                <StaggerItem key={t.id}>
                  <motion.button
                    layout
                    onClick={() => {
                      pushRecent({ id: t.id, code: t.code, title: t.title });
                      navigate("tender", { tenderId: t.id, tenderLabel: t.code });
                    }}
                    className="card-hairline card-hairline-hover group flex w-full flex-row items-start gap-3.5 p-4 text-left sm:items-center sm:gap-5"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                      <Building2 className="size-5" strokeWidth={1.6} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium tracking-tight">
                        {t.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{t.code}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{t.department}</span>
                        <span aria-hidden className="hidden sm:inline">
                          ·
                        </span>
                        <span className="hidden items-center gap-1 sm:inline-flex">
                          <Users className="size-3" />
                          {t.bidderCount}
                        </span>
                      </span>
                    </span>

                    <span className="flex items-center justify-between gap-3 sm:justify-end sm:gap-5">
                      <span className="flex flex-col items-start gap-1 sm:items-end">
                        <StatusPill kind={t.status} />
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[11px]",
                            soon ? "font-medium text-warn" : "text-muted-foreground"
                          )}
                        >
                          <Clock3 className="size-3" />
                          {t.status === "OPEN" ? `Closes ${fmtDate(t.closesAt)}` : `Closed ${fmtDate(t.closesAt)}`}
                        </span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                    </span>
                  </motion.button>
                </StaggerItem>
              );
            })}
          </AnimatePresence>
        </Stagger>
      )}
    </div>
  );
}
