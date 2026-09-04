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
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { BidderDetail, CheckStatus } from "@/lib/types";
import { COMPLIANCE_CHECK_NAMES } from "@/lib/types";
import { EASE, Mark } from "./motion";
import { StatusPill } from "./status-pill";
import { cn } from "@/lib/utils";

export interface VerifyRun {
  bidderId: string;
  company: string;
}

const STEP_MS = 300;

function stepIcon(status: CheckStatus | "loading") {
  if (status === "loading")
    return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />;
  switch (status) {
    case "PASS":
      return <Check className="size-3.5 text-ok" strokeWidth={3} />;
    case "REVIEW":
      return <AlertTriangle className="size-3.5 text-warn" />;
    case "FAIL":
      return <X className="size-3.5 text-bad" strokeWidth={3} />;
    default:
      return <CircleMinus className="size-3.5 text-muted-foreground/60" />;
  }
}

function stepRowCls(status: CheckStatus | "loading") {
  switch (status) {
    case "PASS":
      return "text-foreground";
    case "REVIEW":
      return "text-warn";
    case "FAIL":
      return "text-bad";
    case "NA":
      return "text-muted-foreground/60";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Full-screen cinematic verification loader.
 * Runs each bidder sequentially; reveals the 8 registry checks step-by-step,
 * then an "AI analysis" beat, then the verdict — before closing.
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
  const [revealed, setRevealed] = useState(0);
  const [statuses, setStatuses] = useState<(CheckStatus | "loading")[]>(
    Array(8).fill("loading")
  );
  const [phase, setPhase] = useState<"checks" | "ai" | "verdict">("checks");
  const [result, setResult] = useState<BidderDetail | null>(null);
  const resultsRef = useRef<BidderDetail[]>([]);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const run = async () => {
      for (let i = 0; i < runs.length; i++) {
        if (cancelled.current) return;
        setIdx(i);
        setRevealed(0);
        setStatuses(Array(8).fill("loading"));
        setPhase("checks");
        setResult(null);

        const startedAt = Date.now();
        const fetchP = api.verifyBidder(runs[i].bidderId).catch(() => null);
        const timers: number[] = [];
        const TOTAL_MS = STEP_MS * 8 + 1450; // checks reveal + AI beat

        // reveal check rows one by one
        for (let s = 1; s <= 8; s++) {
          timers.push(
            window.setTimeout(() => {
              if (!cancelled.current) setRevealed(s);
            }, STEP_MS * s)
          );
        }
        timers.push(
          window.setTimeout(() => {
            if (!cancelled.current) setPhase("ai");
          }, STEP_MS * 8 + 420)
        );

        const res = await fetchP;
        // hold until the choreography catches up so the reveal feels real
        const elapsed = Date.now() - startedAt;
        if (elapsed < TOTAL_MS) {
          await new Promise((r) => setTimeout(r, TOTAL_MS - elapsed));
        }

        if (cancelled.current) return;
        if (res) {
          const byName = new Map(res.bidder.checks.map((c) => [c.name, c.status]));
          setStatuses(
            COMPLIANCE_CHECK_NAMES.map(
              (n) => (byName.get(n) ?? "NA") as CheckStatus
            )
          );
          resultsRef.current.push(res.bidder);
        } else {
          setStatuses(Array(8).fill("NA"));
        }
        setResult(res?.bidder ?? null);
        setPhase("verdict");
        await new Promise((r) => setTimeout(r, 1150));
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
        className="card-hairline w-full max-w-md overflow-hidden"
      >
        {/* header */}
        <div className="border-b border-border px-6 pt-6 pb-5 text-center">
          <div className="relative mx-auto flex size-14 items-center justify-center">
            <span className="animate-spin-slow absolute inset-0 rounded-full border border-dashed border-foreground/25" />
            <Mark className="size-7 text-foreground" />
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            <Sparkles className="size-3" />
            Running verification
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={run?.bidderId ?? idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="font-display mt-1 truncate text-2xl"
            >
              {run?.company ?? "…"}
            </motion.p>
          </AnimatePresence>
          {total > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Bidder {idx + 1} of {total}
            </p>
          )}
          {/* progress hairline */}
          <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full bg-primary"
              animate={{
                width:
                  phase === "verdict"
                    ? "100%"
                    : `${((revealed / 8) * 82 + (phase === "ai" ? 10 : 4)).toFixed(1)}%`,
              }}
              transition={{ ease: "easeOut", duration: 0.35 }}
            />
          </div>
        </div>

        {/* steps */}
        <div className="max-h-72 overflow-y-auto px-6 py-4">
          <ul className="space-y-0.5">
            {COMPLIANCE_CHECK_NAMES.map((name, i) => {
              const hidden = i >= revealed;
              return (
                <motion.li
                  key={name}
                  initial={false}
                  animate={{ opacity: hidden ? 0.25 : 1, x: hidden ? -6 : 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-[7px] text-[13px]",
                    stepRowCls(phase === "verdict" && statuses[i] !== "loading" ? statuses[i] : "loading"),
                    hidden && "text-muted-foreground/40"
                  )}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    {stepIcon(phase === "verdict" ? statuses[i] : "loading")}
                  </span>
                  <span className="flex-1 text-left">{name}</span>
                </motion.li>
              );
            })}
          </ul>

          {/* AI beat */}
          <AnimatePresence>
            {(phase === "ai" || phase === "verdict") && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-accent/60 px-3 py-2.5 text-[13px] text-accent-foreground"
              >
                {phase === "ai" ? (
                  <>
                    <Sparkles className="size-4 animate-pulse text-primary" />
                    AI analysing results…
                  </>
                ) : (
                  <>
                    <Check className="size-4 text-ok" strokeWidth={3} />
                    AI analysis complete
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* verdict footer */}
        <div className="border-t border-border bg-secondary/40 px-6 py-4">
          <AnimatePresence mode="wait">
            {phase === "verdict" && result ? (
              <motion.div
                key="verdict"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Compliance score</p>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {result.score ?? 0}
                    <span className="text-sm font-normal text-muted-foreground">/100</span>
                  </p>
                </div>
                <StatusPill kind={result.status} className="scale-110" />
              </motion.div>
            ) : (
              <motion.p
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-xs text-muted-foreground"
              >
                Querying simulated government registries…
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          aria-label="Hide loader"
        >
          <X className="size-4" />
        </button>
      )}
    </motion.div>
  );
}
