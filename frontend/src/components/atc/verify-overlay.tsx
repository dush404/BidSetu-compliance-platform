"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CircleMinus,
  Loader2,
  ShieldCheck,
  Sparkles,
  FileText,
  Binary,
  Cpu,
  Database,
  Scale,
  Save,
} from "lucide-react";
import { api } from "@/lib/api";
import type { BidderDetail, CheckStatus } from "@/lib/types";
import { EASE, Mark } from "./motion";
import { StatusPill } from "./status-pill";
import { cn } from "@/lib/utils";

export interface VerifyRun {
  bidderId: string;
  company: string;
}

export const PIPELINE_STEPS = [
  { id: "docs", label: "Loading bidder documents", icon: FileText },
  { id: "text", label: "Extracting document text (PyMuPDF)", icon: Binary },
  { id: "qwen", label: "Local Qwen structured extraction", icon: Cpu },
  { id: "struct", label: "Structuring bidder credentials", icon: FileText },
  { id: "gst", label: "Checking GST Database", icon: Database },
  { id: "pan", label: "Checking Income Tax PAN Database", icon: Database },
  { id: "udyam", label: "Checking Udyam / MSME Registry", icon: Database },
  { id: "epfo", label: "Checking EPFO Compliance", icon: Database },
  { id: "esic", label: "Checking ESIC Registration", icon: Database },
  { id: "dpiit", label: "Checking DPIIT Startup India", icon: Database },
  { id: "nsic", label: "Checking NSIC Database", icon: Database },
  { id: "blacklist", label: "Checking Central Blacklist", icon: ShieldCheck },
  { id: "rules", label: "Running deterministic compliance rules", icon: Scale },
  { id: "ai", label: "Generating Local Qwen explanation", icon: Cpu },
  { id: "save", label: "Saving verification result & logs", icon: Save },
] as const;

const STEP_MS = 220;

/**
 * Full-screen cinematic verification pipeline loader.
 * Shows the document-first, local-AI only pipeline step by step.
 */
export function VerifyOverlay({
  runs,
  onAllDone,
  onClose,
}: {
  runs: VerifyRun[];
  onAllDone: (results: BidderDetail[]) => void;
  onClose?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState<"pipeline" | "verdict">("pipeline");
  const [result, setResult] = useState<BidderDetail | null>(null);
  const resultsRef = useRef<BidderDetail[]>([]);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const run = async () => {
      for (let i = 0; i < runs.length; i++) {
        if (cancelled.current) return;
        setIdx(i);
        setCurrentStep(0);
        setPhase("pipeline");
        setResult(null);

        const startedAt = Date.now();
        const fetchP = api.verifyBidder(runs[i].bidderId).catch(() => null);
        const timers: number[] = [];
        const totalSteps = PIPELINE_STEPS.length;
        const TOTAL_MS = STEP_MS * totalSteps + 800;

        // Advance through the 15 pipeline milestones
        for (let s = 1; s <= totalSteps; s++) {
          timers.push(
            window.setTimeout(() => {
              if (!cancelled.current) setCurrentStep(s);
            }, STEP_MS * s)
          );
        }

        const res = await fetchP;
        const elapsed = Date.now() - startedAt;
        if (elapsed < TOTAL_MS) {
          await new Promise((r) => setTimeout(r, TOTAL_MS - elapsed));
        }

        if (cancelled.current) return;
        if (res) {
          resultsRef.current.push(res.bidder);
          setResult(res.bidder);
        }

        setPhase("verdict");
        await new Promise((r) => setTimeout(r, 1400));
        timers.forEach((t) => window.clearTimeout(t));
      }
      if (!cancelled.current) onAllDone(resultsRef.current);
    };
    void run();
    return () => {
      cancelled.current = true;
    };
  }, []);

  const run = runs[idx];
  const total = runs.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-background/92 p-4 backdrop-blur-md"
      role="alertdialog"
      aria-label="Running verification"
    >
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="card-hairline w-full max-w-lg overflow-hidden shadow-2xl bg-card border border-border"
      >
        {/* header */}
        <div className="border-b border-border px-6 pt-6 pb-4 text-center bg-muted/20">
          <div className="relative mx-auto flex size-12 items-center justify-center">
            <span className="animate-spin-slow absolute inset-0 rounded-full border border-dashed border-primary/40" />
            <Mark className="size-6 text-foreground" />
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
            <Cpu className="size-3.5" />
            Document-First · Local Qwen Verification
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={run?.bidderId ?? idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="font-display mt-1 truncate text-xl font-bold"
            >
              {run?.company ?? "…"}
            </motion.p>
          </AnimatePresence>
          {total > 1 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bidder {idx + 1} of {total}
            </p>
          )}
          {/* progress bar */}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full bg-primary"
              animate={{
                width:
                  phase === "verdict"
                    ? "100%"
                    : `${((currentStep / PIPELINE_STEPS.length) * 100).toFixed(1)}%`,
              }}
              transition={{ ease: "easeOut", duration: 0.25 }}
            />
          </div>
        </div>

        {/* pipeline steps */}
        <div className="max-h-80 overflow-y-auto px-6 py-4 space-y-1">
          {PIPELINE_STEPS.map((step, i) => {
            const isDone = currentStep > i || phase === "verdict";
            const isCurrent = currentStep === i && phase === "pipeline";
            const isPending = currentStep < i && phase === "pipeline";
            const StepIcon = step.icon;

            return (
              <motion.div
                key={step.id}
                initial={false}
                animate={{ opacity: isPending ? 0.35 : 1 }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                  isCurrent && "bg-primary/10 text-primary font-medium",
                  isDone && "text-foreground",
                  isPending && "text-muted-foreground/60"
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {isDone ? (
                    <Check className="size-3.5 text-ok" strokeWidth={3} />
                  ) : isCurrent ? (
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  ) : (
                    <StepIcon className="size-3.5 text-muted-foreground/40" />
                  )}
                </span>
                <span className="flex-1 text-left truncate">{step.label}</span>
                {isDone && (
                  <span className="text-[10px] font-semibold text-ok uppercase tracking-wider">
                    Done
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* verdict footer */}
        <div className="border-t border-border bg-secondary/40 px-6 py-4">
          <AnimatePresence mode="wait">
            {phase === "verdict" && result ? (
              <motion.div
                key="verdict"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Compliance Score</p>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {result.score ?? 0}
                    <span className="text-sm font-normal text-muted-foreground">/100</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {result.risk && <StatusPill kind={result.risk} size="sm" />}
                  {result.recommendation && (
                    <StatusPill kind={result.recommendation} size="sm" />
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  <span>Processing through deterministic rules…</span>
                </span>
                <span className="font-mono text-[11px]">Local Qwen 7B</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}