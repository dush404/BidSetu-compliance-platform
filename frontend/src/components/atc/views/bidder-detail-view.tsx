"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  ChevronDown,
  CircleMinus,
  Clock3,
  Database,
  FileText,
  Fingerprint,
  Info,
  Landmark,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
  CheckCircle2,
  FileDown,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { BidderDetail, CheckStatus, OfficerDecision } from "@/lib/types";
import { decisionLabel, fmtDateTime, timeAgo } from "@/lib/format";
import { PageHeader } from "../page-header";
import { Reveal } from "../motion";
import { StatusPill } from "../status-pill";
import { ScoreRing } from "../score-ring";
import { BidderDetailSkeleton } from "../skeletons";
import { EmptyState } from "../empty-state";
import { VerifyOverlay, type VerifyRun } from "../verify-overlay";
import { AiDocScan } from "../ai-doc-scan";
import { cn } from "@/lib/utils";

function CheckIcon({ status }: { status: CheckStatus }) {
  const cls = {
    PASS: "text-ok",
    REVIEW: "text-warn",
    FAIL: "text-bad",
    NA: "text-muted-foreground/50",
  }[status];
  const Icon = {
    PASS: CheckCircle2,
    REVIEW: AlertTriangle,
    FAIL: XCircle,
    NA: CircleMinus,
  }[status];
  return <Icon className={cn("size-4.5 shrink-0", cls)} strokeWidth={status === "NA" ? 1.5 : 2} />;
}

const badge: Record<CheckStatus, { label: string; cls: string }> = {
  PASS: { label: "Pass", cls: "text-ok bg-ok-soft border-ok/25" },
  REVIEW: { label: "Review", cls: "text-warn bg-warn-soft border-warn/30" },
  FAIL: { label: "Fail", cls: "text-bad bg-bad-soft border-bad/25" },
  NA: { label: "N/A", cls: "text-muted-foreground bg-muted border-border" },
};

export function BidderDetailView({ bidderId }: { bidderId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const [bidder, setBidder] = useState<BidderDetail | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [run, setRun] = useState<VerifyRun | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError(false);
    try {
      const r = await api.getBidder(bidderId);
      setBidder(r.bidder);
    } catch {
      setError(true);
    }
  }, [bidderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Bidder unavailable"
        hint="We could not load this bidder's verification record."
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

  if (!bidder) return <BidderDetailSkeleton />;

  const pass = bidder.checks.filter((c) => c.status === "PASS").length;
  const fail = bidder.checks.filter((c) => c.status === "FAIL").length;
  const review = bidder.checks.filter((c) => c.status === "REVIEW").length;
  const notVerified = bidder.checks.length === 0;

  const decide = async (decision: OfficerDecision) => {
    setDeciding(true);
    try {
      await api.decide(bidderId, decision, note || undefined);
      toast.success(`Decision recorded — ${decisionLabel[decision]}`, {
        description: "This action has been written to the audit trail.",
      });
      setNote("");
      await load();
    } catch {
      toast.error("Could not record decision. Try again.");
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        onBack={() => navigate("tender", { tenderId: bidder.tender.id, tenderLabel: bidder.tender.code })}
        backLabel="Back to tender"
        eyebrow={
          <>
            <span className="font-mono text-xs text-muted-foreground">{bidder.tender.code}</span>
            <StatusPill kind={bidder.status} />
            {bidder.dataSource && (
              <span className="inline-flex items-center gap-1 rounded-full border border-warn/25 bg-warn-soft/60 px-2.5 py-0.5 text-[11px] font-medium text-warn">
                <Database className="size-3" /> Simulated DB
              </span>
            )}
          </>
        }
        title={bidder.company}
        sub={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Fingerprint className="size-3.5" /> Contact: {bidder.contactName}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
              GSTIN {bidder.gstin}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
              PAN {bidder.pan}
            </span>
            {bidder.lastCheckedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" /> Checked {timeAgo(bidder.lastCheckedAt)}
              </span>
            )}
          </span>
        }
      />

      {notVerified ? (
        /* ——— Not yet verified ——— */
        <Reveal>
          <div className="card-hairline flex flex-col items-center gap-5 px-6 py-16 text-center">
            <div className="animate-floaty flex size-20 items-center justify-center rounded-full border border-dashed border-primary/30 bg-accent/40">
              <ShieldCheck className="size-8 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-display text-2xl">Awaiting verification</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {bidder.company} has not been checked against the government
                registries yet. Run the verification to generate a compliance
                score and AI summary.
              </p>
            </div>
            <button
              onClick={() => setRun({ bidderId: bidder.id, company: bidder.company })}
              className="group flex min-h-12 items-center gap-2.5 rounded-full bg-foreground px-7 text-sm font-medium text-primary-foreground transition-all hover:shadow-[0_10px_28px_-8px_oklch(0.245_0.014_105/0.45)]"
            >
              <ShieldCheck className="size-4 transition-transform duration-300 group-hover:scale-110" />
              Run verification
            </button>
          </div>
        </Reveal>
      ) : (
        <>
          {/* ——— Score + summary ——— */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Reveal className="card-hairline flex flex-col items-center justify-center p-5">
              <ScoreRing score={bidder.score ?? 0} size={112} stroke={9} />
              <p className="mt-3 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Compliance score
              </p>
            </Reveal>

            <Reveal delay={0.07} className="card-hairline flex flex-col justify-center gap-5 p-6">
              <div className="flex flex-wrap items-center gap-2.5">
                {bidder.risk && <StatusPill kind={bidder.risk} className="scale-105" />}
                {bidder.recommendation && (
                  <StatusPill kind={bidder.recommendation} className="scale-105" />
                )}
                <span className="ml-auto text-right text-[11px] text-muted-foreground">
                  Last checked
                  <span className="block font-medium text-foreground">
                    {fmtDateTime(bidder.lastCheckedAt)}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { n: pass, label: "Pass", Icon: CheckCircle2, cls: "text-ok" },
                  { n: fail, label: "Fail", Icon: XCircle, cls: "text-bad" },
                  { n: review, label: "Review", Icon: AlertTriangle, cls: "text-warn" },
                ].map(({ n, label, Icon, cls }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3"
                  >
                    <Icon className={cn("size-4.5", cls)} />
                    <span>
                      <span className={cn("block text-lg font-semibold tabular-nums", cls)}>{n}</span>
                      <span className="block text-[11px] text-muted-foreground">{label}</span>
                    </span>
                  </div>
                ))}
              </div>

              {bidder.aiSummary && (
                <p className="border-l-2 border-primary/30 pl-4 text-[13px] leading-relaxed text-muted-foreground">
                  {bidder.aiSummary}
                </p>
              )}
            </Reveal>
          </div>

          {/* ——— Main grid ——— */}
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              {/* checklist */}
              <section aria-label="Compliance checklist">
                <Reveal className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <h2 className="font-display text-2xl">Compliance checklist</h2>
                </Reveal>
                <Reveal delay={0.05} className="card-hairline divide-y divide-border overflow-hidden">
                  {bidder.checks.map((c) => {
                    const open = expanded === c.id;
                    return (
                      <div key={c.id}>
                        <button
                          onClick={() => setExpanded(open ? null : c.id)}
                          aria-expanded={open}
                          className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                        >
                          <CheckIcon status={c.status} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{c.name}</span>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-px text-[10px] font-semibold tracking-wide uppercase",
                                  badge[c.status].cls
                                )}
                              >
                                {badge[c.status].label}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {c.detail}
                            </span>
                          </span>
                          <span className="hidden text-right text-[11px] text-muted-foreground md:block">
                            {c.source}
                          </span>
                          <motion.span
                            animate={{ rotate: open ? 180 : 0 }}
                            transition={{ duration: 0.25 }}
                            className="text-muted-foreground"
                          >
                            <ChevronDown className="size-4" />
                          </motion.span>
                        </button>
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div
                                className={cn(
                                  "mx-5 mb-4 rounded-lg border p-4 text-[13px] leading-relaxed",
                                  c.status === "FAIL"
                                    ? "border-bad/20 bg-bad-soft/50 text-bad"
                                    : c.status === "REVIEW"
                                      ? "border-warn/25 bg-warn-soft/50 text-warn"
                                      : "border-ok/20 bg-ok-soft/40 text-foreground"
                                )}
                              >
                                {c.verifiedValue && (
                                  <p className="mb-1.5">
                                    <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                                      Verified (database)
                                    </span>
                                    <span className="mt-0.5 block font-mono text-xs">
                                      {c.verifiedValue}
                                    </span>
                                  </p>
                                )}
                                <p>
                                  <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                                    Finding
                                  </span>
                                  <span className="mt-0.5 block">{c.finding}</span>
                                </p>
                                <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <Database className="size-3" /> {c.source}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </Reveal>
              </section>

              {/* documents */}
              <section aria-label="Uploaded documents">
                <Reveal className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <h2 className="font-display text-2xl">Uploaded documents</h2>
                  </div>
                  <AiDocScan />
                </Reveal>
                {bidder.documents.length === 0 ? (
                  <Reveal delay={0.05}>
                    <div className="card-hairline flex items-center gap-4 p-6 text-muted-foreground">
                      <div className="flex size-11 items-center justify-center rounded-full border border-dashed border-border">
                        <FileDown className="size-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">No documents uploaded</p>
                        <p className="text-xs">The bidder has not attached supporting files.</p>
                      </div>
                    </div>
                  </Reveal>
                ) : (
                  <Reveal delay={0.05} className="card-hairline divide-y divide-border overflow-hidden">
                    {bidder.documents.map((d) => (
                      <div key={d.id} className="group flex items-center gap-4 px-5 py-3.5">
                        <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          {d.type}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{d.name}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {d.size} · uploaded {fmtDateTime(d.uploadedAt).split(",")[0]}
                          </span>
                        </span>
                        <button
                          onClick={() =>
                            toast.info("Demo environment", {
                              description: `“${d.name}” is a simulated document.`,
                            })
                          }
                          className="flex min-h-9 items-center rounded-full border border-border px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Preview
                        </button>
                      </div>
                    ))}
                  </Reveal>
                )}
              </section>
            </div>

            {/* ——— Right rail ——— */}
            <div className="space-y-5">
              {/* AI summary */}
              <Reveal className="card-hairline overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-accent/40 px-5 py-3.5">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-tight">AI verification summary</h3>
                </div>
                <div className="space-y-3.5 px-5 py-4">
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {bidder.aiSummary ?? "No AI summary available."}
                  </p>
                  <dl className="space-y-2 text-[13px]">
                    {bidder.recommendation && (
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Recommendation</dt>
                        <dd><StatusPill kind={bidder.recommendation} size="xs" /></dd>
                      </div>
                    )}
                    {bidder.confidence !== null && (
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Confidence</dt>
                        <dd className="font-semibold tabular-nums">{bidder.confidence}%</dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Data source</dt>
                      <dd className="font-medium">Simulated Gov. DB</dd>
                    </div>
                  </dl>
                  <p className="flex gap-2 rounded-lg bg-muted/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    AI is a decision-support tool only. The final qualification
                    decision rests with the Procurement Officer.
                  </p>
                </div>
              </Reveal>

              {/* why this result */}
              <Reveal delay={0.06} className="card-hairline p-5">
                <h3 className="mb-3 text-sm font-semibold tracking-tight">Why this result?</h3>
                <ul className="space-y-2">
                  {bidder.checks
                    .filter((c) => c.status !== "NA")
                    .map((c) => (
                      <li key={c.id} className="flex items-start gap-2.5 text-[13px]">
                        <CheckIcon status={c.status} />
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">{c.name}</span> —{" "}
                          {c.status === "PASS"
                            ? "verified and active"
                            : c.status === "FAIL"
                              ? c.detail.toLowerCase()
                              : c.detail.toLowerCase()}
                        </span>
                      </li>
                    ))}
                </ul>
              </Reveal>

              {/* officer decision */}
              <Reveal delay={0.12} className="card-hairline overflow-hidden">
                <div className="border-b border-border px-5 py-3.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <Landmark className="size-4 text-primary" />
                    Officer decision
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Your decision is final and will be logged
                  </p>
                </div>
                <div className="space-y-2.5 p-5">
                  {(
                    [
                      {
                        d: "QUALIFY" as OfficerDecision,
                        label: "Qualify bidder",
                        icon: CheckCircle2,
                        cls: "bg-ok text-white hover:brightness-105 shadow-[0_6px_18px_-8px_color-mix(in_oklch,var(--ok)_70%,transparent)]",
                        dialogCls: "bg-ok text-white",
                      },
                      {
                        d: "CLARIFY" as OfficerDecision,
                        label: "Request clarification",
                        icon: AlertTriangle,
                        cls: "border border-warn/40 bg-warn-soft text-warn hover:bg-warn-soft/70",
                        dialogCls: "bg-warn text-white",
                      },
                      {
                        d: "DISQUALIFY" as OfficerDecision,
                        label: "Disqualify bidder",
                        icon: XCircle,
                        cls: "border border-bad/30 bg-bad-soft text-bad hover:bg-bad-soft/70",
                        dialogCls: "bg-bad text-white",
                      },
                    ]
                  ).map(({ d, label, icon: Icon, cls }) => (
                    <AlertDialog key={d}>
                      <AlertDialogTrigger asChild>
                        <button
                          disabled={deciding}
                          className={cn(
                            "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60",
                            cls
                          )}
                        >
                          {deciding ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                          {label}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-display text-2xl">
                            Confirm — {decisionLabel[d].toLowerCase()}?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-[13px] leading-relaxed">
                            You are about to mark{" "}
                            <span className="font-semibold text-foreground">{bidder.company}</span>{" "}
                            as <span className="font-semibold text-foreground">{decisionLabel[d]}</span>{" "}
                            for {bidder.tender.code}. This will be recorded in the audit trail
                            with your name and a timestamp.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Optional note for the record…"
                          rows={3}
                          className="w-full resize-none rounded-xl border border-input bg-background p-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_9%,transparent)]"
                        />
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void decide(d)}
                            disabled={deciding}
                            className={cn("rounded-full", d === "QUALIFY" ? "bg-ok text-white" : d === "DISQUALIFY" ? "bg-bad text-white" : "bg-warn text-white")}
                          >
                            {deciding ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <BadgeCheck className="size-4" />
                            )}
                            Confirm decision
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ))}
                  <p className="pt-1 text-center text-[11px] text-muted-foreground">
                    AI suggests:{" "}
                    <span className="font-semibold text-foreground">
                      {bidder.recommendation ? decisionLabel[bidder.recommendation] : "Run verification first"}
                    </span>
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </>
      )}

      {/* tender context */}
      <Reveal>
        <button
          onClick={() =>
            navigate("tender", { tenderId: bidder.tender.id, tenderLabel: bidder.tender.code })
          }
          className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Building2 className="size-4" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            Part of{" "}
            <span className="font-medium">{bidder.tender.title}</span>
            <span className="block text-xs text-muted-foreground">
              {bidder.tender.department}
            </span>
          </span>
          <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            Open tender →
          </span>
        </button>
      </Reveal>

      {/* single verify overlay */}
      <AnimatePresence>
        {run && (
          <VerifyOverlay
            key={run.bidderId}
            runs={[run]}
            onAllDone={() => {
              setRun(null);
              void load();
              toast.success("Verification complete", {
                description: "Compliance results and audit trail updated.",
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
