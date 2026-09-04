"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Landmark,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserCheck,
  WifiOff,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { AuditEntry } from "@/lib/types";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { PageHeader } from "../page-header";
import { Reveal, Stagger, StaggerItem } from "../motion";
import { StatusPill } from "../status-pill";
import { EmptyState } from "../empty-state";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEvent {
  ts: string;
  stage: string;
  level: string;
  msg: string;
  data: Record<string, unknown>;
}

// ── Pipeline stage config ─────────────────────────────────────────────────────

const STAGES = [
  { key: "FETCH", label: "Fetch", color: "text-blue-500", bg: "bg-blue-500/10" },
  { key: "DB", label: "DB Checks", color: "text-cyan-500", bg: "bg-cyan-500/10" },
  { key: "RULES", label: "Rules", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { key: "AI", label: "AI", color: "text-purple-500", bg: "bg-purple-500/10" },
  { key: "SAVE", label: "Save", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { key: "DONE", label: "Done", color: "text-ok", bg: "bg-ok/10" },
] as const;

function stageConfig(stage: string) {
  const key = stage.split(":")[0];
  return STAGES.find((s) => s.key === key) ?? { key, label: stage, color: "text-muted-foreground", bg: "bg-muted" };
}

function levelColor(level: string) {
  if (level === "ERROR") return "text-bad";
  if (level === "WARN") return "text-warn";
  return "text-muted-foreground";
}

// ── Live Pipeline Monitor ─────────────────────────────────────────────────────

function PipelineMonitor() {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const pauseScroll = useRef(false);

  // Load recent history on mount
  useEffect(() => {
    fetch("/api/dev/logs?limit=100")
      .then((r) => r.json())
      .then((d: { events?: LogEvent[] }) => {
        if (Array.isArray(d.events)) setEvents(d.events);
      })
      .catch(() => {});
  }, []);

  // Open SSE stream
  useEffect(() => {
    const es = new EventSource("/api/dev/log-stream");
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data as string) as LogEvent;
        setEvents((prev) => [...prev.slice(-299), ev]);
        setActiveStage(ev.stage.split(":")[0]);
      } catch {}
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  // Auto-scroll to bottom unless user is hovering
  useEffect(() => {
    if (!pauseScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  const clearLogs = () => setEvents([]);

  return (
    <div className="card-hairline overflow-hidden">
      {/* Monitor header */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Activity className={cn("size-4", connected ? "text-ok animate-pulse" : "text-muted-foreground")} />
          <span className="text-[14px] font-semibold tracking-tight">Pipeline Monitor</span>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            connected ? "bg-ok/10 text-ok" : "bg-muted text-muted-foreground"
          )}>
            {connected ? "● LIVE" : "○ OFFLINE"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-muted"
          >
            {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </header>

      {/* Pipeline stage progress bar */}
      {!collapsed && (
        <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-4 py-2">
          {STAGES.map((s, i) => {
            const isActive = activeStage === s.key;
            const isPast = activeStage
              ? STAGES.findIndex((x) => x.key === activeStage) > i
              : false;
            return (
              <div key={s.key} className="flex items-center gap-1 flex-1 min-w-0">
                <span className={cn(
                  "truncate rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all",
                  isActive ? `${s.bg} ${s.color} scale-105` : isPast ? "bg-ok/10 text-ok" : "bg-muted text-muted-foreground/50"
                )}>
                  {s.label}
                </span>
                {i < STAGES.length - 1 && (
                  <div className={cn("h-px flex-1 rounded", isPast || isActive ? "bg-ok/40" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Terminal feed */}
      {!collapsed && (
        <div
          className="max-h-72 overflow-y-auto bg-[hsl(var(--card))] p-3 font-mono text-[11px] [scrollbar-width:thin]"
          onMouseEnter={() => { pauseScroll.current = true; }}
          onMouseLeave={() => { pauseScroll.current = false; }}
        >
          {events.length === 0 && (
            <p className="text-muted-foreground/60 py-4 text-center">
              {connected ? "Waiting for pipeline events…" : "Connecting to AI worker…"}
            </p>
          )}
          {events.map((ev, i) => {
            const s = stageConfig(ev.stage);
            const time = new Date(ev.ts).toLocaleTimeString("en-IN", { hour12: false });
            return (
              <div key={i} className="flex items-start gap-2 py-0.5 hover:bg-muted/40 rounded px-1">
                <span className="shrink-0 text-muted-foreground/50">{time}</span>
                <span className={cn("shrink-0 rounded px-1 font-semibold", s.color)}>[{ev.stage}]</span>
                <span className={cn("flex-1 break-all", levelColor(ev.level))}>{ev.msg}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {!connected && !collapsed && (
        <div className="flex items-center gap-2 border-t border-border px-5 py-2 text-[11px] text-muted-foreground">
          <WifiOff className="size-3.5" />
          AI worker is offline — logs will stream once reconnected.
        </div>
      )}
    </div>
  );
}

function actionVisual(e: AuditEntry) {
  if (e.decision === "DISQUALIFY")
    return { Icon: XCircle, cls: "text-bad", ring: "border-bad/30 bg-bad-soft" };
  if (e.decision === "CLARIFY")
    return { Icon: AlertTriangle, cls: "text-warn", ring: "border-warn/30 bg-warn-soft" };
  if (e.action === "OFFICER_DECISION")
    return { Icon: UserCheck, cls: "text-ok", ring: "border-ok/30 bg-ok-soft" };
  if (e.action === "SESSION")
    return { Icon: Landmark, cls: "text-muted-foreground", ring: "border-border bg-muted" };
  return { Icon: ShieldCheck, cls: "text-ok", ring: "border-ok/30 bg-ok-soft" };
}

export function AuditView() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const isDeveloper = user?.role === "DEVELOPER";
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (spin = false) => {
    if (spin) setRefreshing(true);
    setError(false);
    try {
      const r = await api.getAudit();
      setEntries(r.entries);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-7">
      {/* Live pipeline monitor — exclusively visible to developers */}
      {isDeveloper && (
        <Reveal delay={0.04}>
          <PipelineMonitor />
        </Reveal>
      )}

      <PageHeader
        eyebrow={
          <span className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Chronological · tamper-evident
          </span>
        }
        title={
          <>
            Verification <em className="text-primary">audit trail</em>.
          </>
        }
        sub="All verification events and officer decisions are recorded chronologically."
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

      {entries === null && !error && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="card-hairline flex items-center gap-4 p-4">
              <div className="shimmer size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="shimmer h-3.5 w-1/3 rounded-md" />
                <div className="shimmer h-2.5 w-1/4 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertTriangle}
          title="Audit log unavailable"
          hint="We could not reach the audit service."
          action={
            <button
              onClick={() => load()}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          }
        />
      )}

      {entries && entries.length === 0 && !error && (
        <EmptyState
          icon={ScrollText}
          title="No audit events yet"
          hint="Verifications and officer decisions will appear here."
        />
      )}

      {entries && entries.length > 0 && (
        <div className="relative">
          {/* spine */}
          <div
            aria-hidden
            className="absolute top-2 bottom-2 left-[22px] w-px bg-gradient-to-b from-border via-border to-transparent sm:left-[26px]"
          />
          <Stagger className="space-y-3">
            {entries.map((e) => {
              const { Icon, cls, ring } = actionVisual(e);
              return (
                <StaggerItem key={e.id}>
                  <motion.div
                    initial={false}
                    className="relative flex gap-4 sm:gap-6"
                  >
                    {/* node */}
                    <div
                      className={cn(
                        "z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 bg-card sm:size-[52px]",
                        ring
                      )}
                    >
                      <Icon className={cn("size-4.5 sm:size-5", cls)} strokeWidth={1.75} />
                    </div>

                    {/* card */}
                    <div className="card-hairline card-hairline-hover group min-w-0 flex-1 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <time className="font-mono text-xs text-muted-foreground">
                          {new Date(e.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </time>
                        {e.decision && <StatusPill kind={e.decision} size="xs" />}
                        <span className="text-[11px] text-muted-foreground/70">
                          {timeAgo(e.createdAt)}
                        </span>
                        {typeof e.score === "number" && (
                          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] tabular-nums">
                            {e.score}/100
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm font-medium">{e.message}</p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {e.bidderId && e.bidderName && (
                          <button
                            onClick={() =>
                              navigate("bidder", {
                                bidderId: e.bidderId!,
                                bidderLabel: e.bidderName!,
                              })
                            }
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {e.bidderName}
                          </button>
                        )}
                        {!e.bidderId && e.bidderName && (
                          <span className="font-medium text-foreground">{e.bidderName}</span>
                        )}
                        {e.tenderCode && (
                          <button
                            onClick={() => navigate("tenders")}
                            className="font-mono underline-offset-4 hover:underline"
                          >
                            {e.tenderCode}
                          </button>
                        )}
                        {e.model && (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> {e.model}
                          </span>
                        )}
                        {e.officer && (
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="size-3" /> {e.officer}
                          </span>
                        )}
                        <span className="ml-auto hidden sm:inline" title={fmtDateTime(e.createdAt)}>
                          {fmtDateTime(e.createdAt)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      )}
    </div>
  );
}
