"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Clock3,
  FileText,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { AuditEntry, Tender } from "@/lib/types";
import { fmtDate, daysUntil, greeting, timeAgo } from "@/lib/format";
import { Reveal, Stagger, StaggerItem } from "../motion";
import { StatTile } from "../stat-tile";
import { StatusPill } from "../status-pill";
import { RowListSkeleton } from "../skeletons";
import { cn } from "@/lib/utils";

export function HomeView() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const [tenders, setTenders] = useState<Tender[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [auditStats, setAuditStats] = useState<AuditEntry[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getTenders()
      .then((r) => setTenders(r.tenders))
      .catch(() => setError(true));
    api
      .getAudit()
      .then((r) => {
        setAuditStats(r.entries);
        setAudit(r.entries.slice(0, 6));
      })
      .catch(() => setError(true));
  }, []);

  const open = tenders?.filter((t) => t.status === "OPEN") ?? [];
  const totalBidders = tenders?.reduce((a, t) => a + t.bidderCount, 0) ?? 0;
  const closingSoon = open.filter((t) => daysUntil(t.closesAt) <= 30).length;

  return (
    <div className="space-y-8">
      {/* greeting */}
      <div>
        <Reveal>
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Overview
            <span aria-hidden>·</span>
            <span className="normal-case tracking-normal">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </p>
        </Reveal>
        <Reveal delay={0.07}>
          <h1 className="font-display mt-2 text-4xl tracking-tight sm:text-5xl">
            {greeting()}, <em className="text-primary">{user?.name ?? "Officer"}</em>.
          </h1>
        </Reveal>
        <Reveal delay={0.13}>
          <p className="mt-2.5 max-w-xl text-[15px] text-muted-foreground">
            Here is the state of procurement today — every number below is
            backed by an audit trail.
          </p>
        </Reveal>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Open tenders"
          value={open.length}
          icon={FileText}
          sub={closingSoon > 0 ? `${closingSoon} closing within 30 days` : "All calm"}
          delay={0.05}
        />
        <StatTile
          label="Total bidders"
          value={totalBidders}
          icon={Users}
          sub="Across all live tenders"
          delay={0.1}
        />
        <StatTile
          label="Registry checks"
          value={auditStats.filter((a) => a.action === "VERIFICATION_COMPLETE").length}
          icon={ShieldCheck}
          sub="Logged verifications"
          delay={0.15}
        />
        <StatTile
          label="Officer decisions"
          value={auditStats.filter((a) => a.action === "OFFICER_DECISION").length}
          icon={BadgeCheck}
          sub="Recorded this cycle"
          delay={0.2}
        />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* tenders in review */}
        <section aria-label="Tenders in review" className="min-w-0">
          <Reveal className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-2xl">Tenders in review</h2>
            <button
              onClick={() => navigate("tenders")}
              className="group flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </Reveal>

          {tenders === null && !error && <RowListSkeleton rows={3} />}
          {error && (
            <p className="card-hairline p-6 text-sm text-bad">
              Could not reach the tender service. Try refreshing.
            </p>
          )}

          {tenders && (
            <Stagger className="space-y-3">
              {tenders.slice(0, 5).map((t) => {
                const due = daysUntil(t.closesAt);
                return (
                  <StaggerItem key={t.id}>
                    <button
                      onClick={() =>
                        navigate("tender", { tenderId: t.id, tenderLabel: t.code })
                      }
                      className="card-hairline card-hairline-hover group flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:gap-4"
                    >
                      <span className="flex min-w-0 items-start gap-3.5 sm:flex-1 sm:items-center sm:gap-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                          <Building2 className="size-4.5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {t.title}
                          </span>
                          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="shrink-0 font-mono">{t.code}</span>
                            <span aria-hidden className="shrink-0">·</span>
                            <span className="min-w-0 truncate">{t.department}</span>
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-3 pl-[54px] sm:flex-col sm:items-end sm:justify-end sm:gap-1.5 sm:pl-0">
                        <StatusPill kind={t.status} />
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[11px]",
                            t.status === "OPEN" && due <= 30
                              ? "font-medium text-warn"
                              : "text-muted-foreground"
                          )}
                        >
                          <Clock3 className="size-3" />
                          {t.status === "OPEN" ? `Closes ${fmtDate(t.closesAt)}` : "Closed"}
                        </span>
                      </span>
                      <ArrowUpRight className="hidden size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground sm:block" />
                    </button>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </section>

        {/* activity */}
        <section aria-label="Recent activity" className="min-w-0">
          <Reveal className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-2xl">Latest activity</h2>
            <button
              onClick={() => navigate("audit")}
              className="group flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Audit log
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card-hairline p-2">
              {audit === null && !error && (
                <div className="space-y-2 p-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="shimmer h-11 rounded-lg" />
                  ))}
                </div>
              )}
              {audit && audit.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No activity yet — run a verification.
                </p>
              )}
              {audit && audit.length > 0 && (
                <ol className="space-y-0.5">
                  {audit.map((e) => (
                    <motion.li
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <button
                        onClick={() => navigate("audit")}
                        className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <span
                          className={cn(
                            "mt-[7px] size-1.5 shrink-0 rounded-full",
                            e.decision === "DISQUALIFY"
                              ? "bg-bad"
                              : e.decision === "CLARIFY"
                                ? "bg-warn"
                                : "bg-ok"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {e.message}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {e.bidderName ?? "System"}
                            {e.tenderCode ? ` · ${e.tenderCode}` : ""} · {timeAgo(e.createdAt)}
                          </span>
                        </span>
                        {typeof e.score === "number" && (
                          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                            {e.score}/100
                          </span>
                        )}
                      </button>
                    </motion.li>
                  ))}
                </ol>
              )}
            </div>
          </Reveal>

          {/* quick action */}
          <Reveal delay={0.2}>
            <button
              onClick={() => navigate("search")}
              className="group mt-4 flex w-full items-center justify-between rounded-xl border border-dashed border-border p-5 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
            >
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Search className="size-4 text-primary" />
                  Looking for a specific tender?
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Search by name, ID or ministry
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
