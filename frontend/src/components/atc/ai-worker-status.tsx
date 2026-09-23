"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkerState =
  | { kind: "checking" }
  | {
      kind: "online";
      aiSource: string;
      version: string | null;
    }
  | { kind: "offline" };

function SubLabel({ state }: { state: WorkerState }) {
  if (state.kind === "checking") return "checking…";
  if (state.kind === "offline") return "offline";
  return state.aiSource;
}

/**
 * Live status pill for the Python AI worker.
 * Shows Local Qwen 7B (Ollama) active status.
 */
export function AiWorkerStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<WorkerState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/ai-worker/health", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          if (data.online) {
            const rawSource = (data.ai_source ?? "Ollama (qwen2.5:7b)").trim();
            const cleanSource = rawSource.replace(/^Ollama\s*\((.*)\)$/i, "Local Qwen: $1");

            setState({
              kind: "online",
              aiSource: cleanSource,
              version: data.version ?? null,
            });
          } else {
            setState({ kind: "offline" });
          }
        }
      } catch {
        if (!cancelled) setState({ kind: "offline" });
      }
    };

    check();
    const t = setInterval(check, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const dotColor =
    state.kind === "checking"
      ? "bg-muted-foreground/50"
      : state.kind === "offline"
        ? "bg-bad"
        : "bg-indigo-500 shadow-sm shadow-indigo-500/50";

  return (
    <span
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 transition-colors",
        state.kind === "online"
          ? "border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20"
          : "border-border bg-card"
      )}
      title={
        state.kind === "online"
          ? `Active Local AI: ${state.aiSource}`
          : "Local Python AI Worker (FastAPI on :8000)"
      }
    >
      <Cpu
        className={cn(
          "size-3.5",
          state.kind === "online"
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-muted-foreground"
        )}
      />
      {compact ? (
        <span className="relative flex size-2">
          {state.kind !== "offline" && (
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                dotColor
              )}
            />
          )}
          <span className={cn("relative inline-flex size-2 rounded-full", dotColor)} />
        </span>
      ) : (
        <>
          <span className="hidden text-[11px] font-medium tracking-wide text-muted-foreground lg:inline">
            Local AI:
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={state.kind + (state.kind === "online" ? state.aiSource : "")}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-1.5 text-[11px] leading-none"
            >
              <span className="relative flex size-1.5">
                {state.kind === "checking" && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-muted-foreground/40" />
                )}
                <span className={cn("relative inline-flex size-1.5 rounded-full", dotColor)} />
              </span>
              <span
                className={cn(
                  "font-mono font-medium",
                  state.kind === "online"
                    ? "text-indigo-700 dark:text-indigo-300 font-semibold"
                    : state.kind === "offline"
                      ? "text-bad"
                      : "text-muted-foreground"
                )}
              >
                <SubLabel state={state} />
              </span>
            </motion.span>
          </AnimatePresence>
        </>
      )}
    </span>
  );
}