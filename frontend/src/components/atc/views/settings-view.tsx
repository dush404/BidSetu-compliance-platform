"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Cloud,
  Cpu,
  Database,
  Info,
  Key,
  Laptop,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TestTube2,
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
const CONNECTORS: { key: string; name: string; path: string }[] = [
  { key: "gst", name: "GST (GSTN)", path: "/api/gst-databases" },
  { key: "pan", name: "PAN (Income Tax)", path: "/api/pan-databases" },
  { key: "udyam", name: "Udyam / MSME", path: "/api/udyam-databases" },
  { key: "epfo", name: "EPFO", path: "/api/epfo-databases" },
  { key: "esic", name: "ESIC", path: "/api/esic-databases" },
  { key: "startup", name: "Startup India (DPIIT)", path: "/api/startup-india-databases" },
  { key: "nsic", name: "NSIC", path: "/api/nsic-databases" },
  { key: "blacklist", name: "Blacklist / Debarment", path: "/api/blacklist-databases" },
  { key: "bidder", name: "Bidder Registry", path: "/api/bidder-applications" },
];

interface ConnectorConfig {
  url: string;
  token: string;
}

interface TestResult {
  ok: boolean;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
}

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

  // Connector config stored in localStorage via ref (no SSR mismatch)
  const [configs, setConfigs] = useState<Record<string, ConnectorConfig>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("atc-connector-configs") ?? "{}");
    } catch {
      return {};
    }
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // AI model test state
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<string | null>(null);
  const [ollamaTestResult, setOllamaTestResult] = useState<string | null>(null);

  // Persist configs to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("atc-connector-configs", JSON.stringify(configs));
    }
  }, [configs]);

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
      local: `Local AI — Ollama (${worker?.ollamaModel ?? "qwen2.5:7b"})`,
      fallback: "Fallback — rule-only mode",
    };

    try {
      const res = await fetch("/api/system/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: m === "local" ? "ollama" : m === "cloud" ? "gemini" : "auto",
          ollama_model: worker?.ollamaModel ?? "qwen2.5:7b",
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

  const testConnector = async (key: string, cfg: ConnectorConfig) => {
    if (!cfg.url) {
      toast.error("Enter an API URL first");
      return;
    }
    setTesting((t) => ({ ...t, [key]: true }));
    setTestResults((r) => ({ ...r, [key]: undefined as unknown as TestResult }));
    try {
      const res = await fetch("/api/system/test-connector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connector: key, url: cfg.url, token: cfg.token }),
      });
      const data = (await res.json()) as TestResult;
      setTestResults((r) => ({ ...r, [key]: data }));
      if (data.ok) {
        toast.success("Connection successful", { description: `${cfg.url} responded in ${data.latencyMs}ms` });
      } else {
        toast.error("Connection failed", { description: data.error ?? `HTTP ${data.statusCode ?? "error"}` });
      }
    } catch (e) {
      setTestResults((r) => ({ ...r, [key]: { ok: false, error: String(e) } }));
      toast.error("Test failed", { description: String(e) });
    } finally {
      setTesting((t) => ({ ...t, [key]: false }));
    }
  };

  const testGemini = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const start = Date.now();
      const res = await fetch("/api/system/status", { cache: "no-store" });
      const data = (await res.json()) as SystemStatus;
      const ms = Date.now() - start;
      if (data.aiWorker.online && data.aiWorker.gemini) {
        setGeminiTestResult(`✓ Online · ${data.aiWorker.aiSource ?? "Gemini"} · ${ms}ms`);
        toast.success("Gemini is reachable", { description: `${data.aiWorker.aiSource} responded in ${ms}ms` });
      } else if (!data.aiWorker.online) {
        setGeminiTestResult("✗ AI worker offline");
        toast.error("AI worker offline");
      } else {
        setGeminiTestResult("✗ GEMINI_API_KEY not configured");
        toast.error("Gemini unavailable", { description: "Add GEMINI_API_KEY to ai-worker/.env" });
      }
    } catch (e) {
      setGeminiTestResult(`✗ ${String(e)}`);
      toast.error("Test failed", { description: String(e) });
    } finally {
      setTestingGemini(false);
    }
  };

  const testOllama = async () => {
    setTestingOllama(true);
    setOllamaTestResult(null);
    try {
      const start = Date.now();
      const res = await fetch("/api/system/status", { cache: "no-store" });
      const data = (await res.json()) as SystemStatus;
      const ms = Date.now() - start;
      if (data.aiWorker.online && data.aiWorker.ollama) {
        setOllamaTestResult(`✓ Online · ${data.aiWorker.ollamaModel ?? "Ollama"} · ${ms}ms`);
        toast.success("Ollama is reachable", { description: `${data.aiWorker.ollamaModel} loaded · ${ms}ms` });
      } else if (!data.aiWorker.online) {
        setOllamaTestResult("✗ AI worker offline");
        toast.error("AI worker offline");
      } else {
        setOllamaTestResult("✗ Ollama not active (worker may be set to Gemini mode)");
        toast.error("Ollama not active", { description: "Switch to Local AI mode or check Ollama service" });
      }
    } catch (e) {
      setOllamaTestResult(`✗ ${String(e)}`);
      toast.error("Test failed", { description: String(e) });
    } finally {
      setTestingOllama(false);
    }
  };

  const MODES: {
    id: AiMode;
    icon: typeof Cloud;
    title: string;
    sub: string;
    live: boolean;
    note: string;
    cascade: string;
  }[] = [
    {
      id: "cloud",
      icon: Cloud,
      title: "Cloud AI",
      sub: "Gemini 3.6 Flash",
      live: cloudLive,
      cascade: "Cloud → Local → Rules",
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
      sub: `Local LLM (Ollama: ${worker?.ollamaModel ?? "qwen2.5:7b"})`,
      live: localLive,
      cascade: "Local → Cloud → Rules",
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
      cascade: "Rules only",
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
              Select the AI mode. Each mode has an automatic fallback cascade if the primary engine fails.
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
                    "group relative flex min-h-36 flex-col items-start rounded-xl border bg-background p-4 text-left transition-all duration-300",
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
                  {/* Cascade priority label */}
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {m.cascade}
                  </span>
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

          {/* AI Model Test Buttons */}
          <div className="border-t border-border px-5 py-4">
            <p className="mb-3 text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              Test AI Connectivity
            </p>
            <div className="flex flex-wrap gap-3">
              {/* Test Gemini */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => void testGemini()}
                  disabled={testingGemini}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {testingGemini ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <TestTube2 className="size-3.5" />
                  )}
                  <Cloud className="size-3" />
                  Test Gemini
                </button>
                {geminiTestResult && (
                  <p className={cn("pl-1 text-[11px]", geminiTestResult.startsWith("✓") ? "text-ok" : "text-bad")}>
                    {geminiTestResult}
                  </p>
                )}
              </div>

              {/* Test Ollama */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => void testOllama()}
                  disabled={testingOllama}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {testingOllama ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <TestTube2 className="size-3.5" />
                  )}
                  <Laptop className="size-3" />
                  Test Ollama
                </button>
                {ollamaTestResult && (
                  <p className={cn("pl-1 text-[11px]", ollamaTestResult.startsWith("✓") ? "text-ok" : "text-bad")}>
                    {ollamaTestResult}
                  </p>
                )}
              </div>
            </div>
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

          <div className="space-y-0.5 p-2 [scrollbar-width:thin]">
            {CONNECTORS.map((c) => {
              const cfg = configs[c.key] ?? { url: "", token: "" };
              const isExpanded = !!expanded[c.key];
              const isTesting = !!testing[c.key];
              const result = testResults[c.key];
              const isLive = !!cfg.url;

              return (
                <div key={c.key} className="rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-colors">
                  {/* Row header */}
                  <button
                    className="flex w-full items-center gap-3 px-3 py-3 text-left"
                    onClick={() => setExpanded((e) => ({ ...e, [c.key]: !e[c.key] }))}
                  >
                    <StatusDot ok={isLive} pulse={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {isLive ? cfg.url : `Simulated via Strapi adapter · ${c.path}`}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                      isLive
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : "border-ok/30 bg-ok-soft text-ok"
                    )}>
                      {isLive ? "Live" : "Simulated"}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {/* Expandable config */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/60 mx-3 pb-3 pt-3 space-y-2">
                          {/* API URL */}
                          <div className="flex items-center gap-2">
                            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <input
                              type="url"
                              placeholder="https://api.example.gov.in/v1"
                              value={cfg.url}
                              onChange={(e) =>
                                setConfigs((prev) => ({
                                  ...prev,
                                  [c.key]: { ...cfg, url: e.target.value },
                                }))
                              }
                              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </div>
                          {/* API Key/Token */}
                          <div className="flex items-center gap-2">
                            <Key className="size-3.5 shrink-0 text-muted-foreground" />
                            <input
                              type="password"
                              placeholder="API key or Bearer token (optional)"
                              value={cfg.token}
                              onChange={(e) =>
                                setConfigs((prev) => ({
                                  ...prev,
                                  [c.key]: { ...cfg, token: e.target.value },
                                }))
                              }
                              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </div>
                          {/* Test button + result */}
                          <div className="flex items-center gap-3 pt-0.5">
                            <button
                              onClick={() => void testConnector(c.key, cfg)}
                              disabled={isTesting || !cfg.url}
                              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                            >
                              {isTesting ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <TestTube2 className="size-3" />
                              )}
                              Test Connection
                            </button>
                            {result && (
                              <span className={cn(
                                "text-[11px] font-medium",
                                result.ok ? "text-ok" : "text-bad"
                              )}>
                                {result.ok
                                  ? `✓ ${result.latencyMs}ms · HTTP ${result.statusCode}`
                                  : `✗ ${result.error ?? `HTTP ${result.statusCode}`}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <footer className="flex items-start gap-2 border-t border-border px-5 py-3.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Connector config is stored locally in your browser. Enter a real API URL and key
              to switch from simulated to live data. Connector routes speak the exact Strapi REST
              dialect the Python AI worker expects.
            </p>
          </footer>
        </section>
      </Reveal>
    </div>
  );
}
