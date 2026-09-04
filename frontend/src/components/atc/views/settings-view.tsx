"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleAlert,
  Cloud,
  Cpu,
  Database,
  Info,
  Laptop,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore, type AiMode } from "@/lib/store";
import { PageHeader } from "../page-header";
import { Reveal, Stagger, StaggerItem } from "../motion";
import { cn } from "@/lib/utils";

interface SystemStatus {
  aiWorker: {
    online: boolean;
    aiSource: string | null;
    version: string | null;
    gemini: boolean;
    ollama?: boolean;
    ollamaModel?: string | null;
  };
  database: {
    online: boolean;
    mode: string;
    label: string;
    latencyMs: number | null;
    error: string | null;
  };
  aiWorkerUrl: string;
  checkedAt: string;
}

/** The 9 simulated government registries the AI worker reads via the adapter. */
const CONNECTORS: { name: string; path: string }[] = [
  { name: "GST (GSTN)", path: "/api/gst-databases" },
  { name: "PAN (Income Tax)", path: "/api/pan-databases" },
  { name: "Udyam / MSME", path: "/api/udyam-databases" },
  { name: "EPFO", path: "/api/epfo-databases" },
  { name: "ESIC", path: "/api/esic-databases" },
  { name: "Startup India (DPIIT)", path: "/api/startup-india-databases" },
  { name: "NSIC", path: "/api/nsic-databases" },
  { name: "Blacklist / Debarment", path: "/api/blacklist-databases" },
  { name: "Bidder Registry", path: "/api/bidder-applications" },
];

function StatusDot({ ok, pulse = true }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="relative flex size-2 shrink-0">
      {ok && pulse && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/50" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          ok ? "bg-ok" : "bg-bad"
        )}
      />
    </span>
  );
}

function LiveBadge({ active }: { active: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={String(active)}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-medium",
          active ? "text-ok" : "text-muted-foreground"
        )}
      >
        {active ? (
          <>
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-ok" />
            </span>
            Active
          </>
        ) : (
          "Standby"
        )}
      </motion.span>
    </AnimatePresence>
  );
}

export function SettingsView() {
  const aiMode = useAppStore((s) => s.aiMode);
  const setAiMode = useAppStore((s) => s.setAiMode);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [rechecking, setRechecking] = useState(false);

  const recheck = useCallback(async () => {
    setRechecking(true);
    try {
      const res = await fetch("/api/system/status", { cache: "no-store" });
      const data = (await res.json()) as SystemStatus;
      setStatus(data);
    } catch {
      toast.error("Status check failed", {
        description: "Could not reach the platform status endpoint.",
      });
    } finally {
      window.setTimeout(() => setRechecking(false), 600);
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  const worker = status?.aiWorker;
  const cloudLive = !!worker?.online && worker.gemini;
  const localLive = !!worker?.online && !!worker.ollama;
  const fallbackLive = !!worker && !worker.online;

  const pickMode = async (m: AiMode) => {
    setAiMode(m);
    const labels: Record<AiMode, string> = {
      cloud: "Cloud AI — Gemini 3.6 Flash",
      local: `Local AI — Ollama (${worker?.ollamaModel ?? "qwen3:14b"})`,
      fallback: "Fallback — rule-only mode",
    };

    try {
      const res = await fetch("/api/system/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: m === "local" ? "ollama" : m === "cloud" ? "gemini" : "auto",
        }),
      });
      if (res.ok) {
        void recheck();
        toast.success("AI Mode Switched", {
          description: `Active Engine set to ${labels[m]}.`,
        });
        return;
      }
    } catch {
      // ignore
    }

    toast.success("AI mode preference saved", {
      description: `${labels[m]} selected.`,
    });
  };

  const MODES: {
    id: AiMode;
    icon: typeof Cloud;
    title: string;
    sub: string;
    live: boolean;
    note: string;
  }[] = [
    {
      id: "cloud",
      icon: Cloud,
      title: "Cloud AI",
      sub: "Gemini 3.6 Flash",
      live: cloudLive,
      note: worker
        ? worker.online
          ? worker.gemini
            ? "Summaries & extraction live via Google API"
            : "Waiting for GEMINI_API_KEY in worker .env"
          : "Worker offline — unreachable"
        : "Checking…",
    },
    {
      id: "local",
      icon: Laptop,
      title: "Local AI",
      sub: `Local LLM (Ollama: ${worker?.ollamaModel ?? "qwen3:14b"})`,
      live: localLive,
      note: worker
        ? worker.online
          ? worker.ollama
            ? `Active on localhost:11434 (${worker.ollamaModel ?? "qwen3:14b"})`
            : "Click to switch active engine to Ollama"
          : "Worker offline"
        : "Checking…",
    },
    {
      id: "fallback",
      icon: ShieldCheck,
      title: "Fallback",
      sub: "Rule-only mode",
      live: fallbackLive,
      note: worker?.online
        ? "Standby — engages if the worker goes offline"
        : "Built-in rule engine is verifying",
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          <span className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Developer console · technical
          </span>
        }
        title={
          <>
            Platform <em className="text-primary">settings</em>.
          </>
        }
        sub="Engine health, AI configuration and the simulated government connectors behind the compliance worker."
      />

      {/* Demo / hackathon notice */}
      <Reveal delay={0.08}>
        <div className="flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn-soft/60 p-4 sm:p-5">
          <CircleAlert className="mt-0.5 size-4.5 shrink-0 text-warn" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-foreground">Demo / Hackathon Mode</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              This platform uses{" "}
              <span className="font-medium text-foreground">
                simulated government databases
              </span>{" "}
              hosted within Strapi. No real GSTN, Income Tax, EPFO, ESIC, or
              Ministry data is accessed. This is a prototype for demonstration
              purposes only.
            </p>
          </div>
        </div>
      </Reveal>

      {/* System status */}
      <Reveal delay={0.12}>
        <section className="card-hairline overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <Database className="size-4 text-primary" />
              System Status
            </h2>
            <button
              onClick={() => void recheck()}
              className="flex min-h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RefreshCw
                className={cn("size-3.5", rechecking && "animate-spin")}
              />
              Recheck
            </button>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {/* AI worker tile */}
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-background p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                <Cpu className="size-4.5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">AI Worker (FastAPI)</span>
                  {status && <StatusDot ok={worker?.online ?? false} />}
                </p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={worker?.aiSource ?? (worker ? "offline" : "checking")}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22 }}
                    className="truncate text-xs text-muted-foreground"
                  >
                    {!status
                      ? "Checking…"
                      : worker?.online
                        ? (worker.aiSource ?? "Rule engine")
                        : "Offline"}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {/* Database tile */}
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-background p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                <Database className="size-4.5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">Strapi CMS / Database</span>
                  {status && <StatusDot ok={status.database.online} />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {!status
                    ? "Checking…"
                    : status.database.online
                      ? `${status.database.label}${status.database.latencyMs != null ? ` · ${status.database.latencyMs}ms` : ""}`
                      : (status.database.error ?? "Unreachable")}
                </p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* AI configuration */}
      <Reveal delay={0.16}>
        <section className="card-hairline overflow-hidden">
          <header className="border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <Cpu className="size-4 text-primary" />
              AI Configuration
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Select the AI mode used for document extraction and
              recommendation generation.
            </p>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            {MODES.map((m) => {
              const selected = aiMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => pickMode(m.id)}
                  aria-pressed={selected}
                  className={cn(
                    "group relative flex min-h-32 flex-col items-start rounded-xl border bg-background p-4 text-left transition-all duration-300",
                    selected
                      ? "border-primary/60 shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_12%,transparent)]"
                      : "border-border hover:border-foreground/25 hover:shadow-[0_2px_10px_-4px_oklch(0.245_0.014_105/0.12)]"
                  )}
                >
                  <m.icon
                    className={cn(
                      "size-4.5 transition-transform duration-300 group-hover:-translate-y-0.5",
                      selected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <p className="mt-3 text-sm font-semibold tracking-tight">
                    {m.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                  <div className="mt-auto pt-3">
                    <LiveBadge active={m.live} />
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground/90">
                      {m.note}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </Reveal>

      {/* Government database connectors */}
      <Reveal delay={0.2}>
        <section className="card-hairline overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <ShieldCheck className="size-4 text-primary" />
              Government Database Connectors
            </h2>
            <span className="text-xs text-muted-foreground">
              {CONNECTORS.length}/{CONNECTORS.length} available
            </span>
          </header>

          <Stagger className="max-h-96 space-y-0.5 overflow-y-auto p-2 [scrollbar-width:thin]">
            {CONNECTORS.map((c) => (
              <StaggerItem key={c.path}>
                <div className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60">
                  <StatusDot ok pulse={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      Simulated via Strapi adapter · {c.path}
                    </p>
                  </div>
                  <span className="rounded-full border border-ok/30 bg-ok-soft px-2.5 py-1 text-[11px] font-medium text-ok">
                    Simulated
                  </span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <footer className="flex items-start gap-2 border-t border-border px-5 py-3.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Connector routes speak the exact Strapi REST dialect the Python
              AI worker expects — when the real Strapi backend connects, the
              worker is repointed without any code changes.
            </p>
          </footer>
        </section>
      </Reveal>
    </div>
  );
}
