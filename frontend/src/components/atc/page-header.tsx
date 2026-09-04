"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "./motion";
import { cn } from "@/lib/utils";

/* Consistent page header: back link, serif title, actions */
export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  onBack,
  backLabel,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {onBack && (
        <Reveal y={-4}>
          <button
            onClick={onBack}
            className="group inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
            {backLabel ?? "Back"}
          </button>
        </Reveal>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow && (
            <Reveal delay={0.02}>
              <div className="flex flex-wrap items-center gap-2.5">{eyebrow}</div>
            </Reveal>
          )}
          <Reveal delay={0.06}>
            <h1 className="font-display text-3xl leading-tight text-pretty sm:text-4xl">
              {title}
            </h1>
          </Reveal>
          {sub && (
            <Reveal delay={0.1}>
              <p className="max-w-2xl text-sm text-muted-foreground">{sub}</p>
            </Reveal>
          )}
        </div>
        {actions && (
          <Reveal delay={0.12} className="shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
          </Reveal>
        )}
      </div>
    </div>
  );
}

/* Hairline tabs with sliding active indicator */
export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  id,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative min-h-9 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">
              {t.label}
              {typeof t.count === "number" && (
                <span
                  className={cn(
                    "ml-1.5 text-[11px] tabular-nums",
                    active ? "text-primary-foreground/70" : "text-muted-foreground/70"
                  )}
                >
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
