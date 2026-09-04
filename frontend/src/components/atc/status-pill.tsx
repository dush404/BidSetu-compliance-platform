"use client";

import { cn } from "@/lib/utils";

export type PillKind =
  | "OPEN"
  | "CLOSED"
  | "PENDING"
  | "PROCESSING"
  | "VERIFIED"
  | "MANUAL_REVIEW"
  | "REJECTED"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL"
  | "QUALIFY"
  | "CLARIFY"
  | "DISQUALIFY";

const MAP: Record<
  PillKind,
  { label: string; cls: string; pulse?: boolean }
> = {
  OPEN: {
    label: "Open",
    cls: "text-ok bg-ok-soft border-ok/25",
    pulse: true,
  },
  CLOSED: { label: "Closed", cls: "text-muted-foreground bg-muted border-border" },
  PENDING: { label: "Pending", cls: "text-muted-foreground bg-muted border-border" },
  PROCESSING: {
    label: "Processing",
    cls: "text-foreground/70 bg-secondary border-border",
  },
  VERIFIED: { label: "Verified", cls: "text-ok bg-ok-soft border-ok/25" },
  MANUAL_REVIEW: {
    label: "Manual review",
    cls: "text-warn bg-warn-soft border-warn/30",
  },
  REJECTED: { label: "Rejected", cls: "text-bad bg-bad-soft border-bad/25" },
  LOW: { label: "Low risk", cls: "text-ok bg-ok-soft border-ok/25" },
  MEDIUM: { label: "Medium", cls: "text-warn bg-warn-soft border-warn/30" },
  HIGH: { label: "High risk", cls: "text-warn bg-warn-soft border-warn/30" },
  CRITICAL: { label: "Critical", cls: "text-bad bg-bad-soft border-bad/25" },
  QUALIFY: { label: "Qualify", cls: "text-ok bg-ok-soft border-ok/25" },
  CLARIFY: { label: "Clarify", cls: "text-warn bg-warn-soft border-warn/30" },
  DISQUALIFY: { label: "Disqualify", cls: "text-bad bg-bad-soft border-bad/25" },
};

export function StatusPill({
  kind,
  className,
  size = "sm",
}: {
  kind: PillKind;
  className?: string;
  size?: "sm" | "xs";
}) {
  const c = MAP[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-2 py-px text-[11px]",
        c.cls,
        className
      )}
    >
      <span className="relative flex size-1.5">
        {c.pulse && (
          <span className="animate-ping-soft absolute inline-flex size-full rounded-full bg-current" />
        )}
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      {c.label}
    </span>
  );
}
