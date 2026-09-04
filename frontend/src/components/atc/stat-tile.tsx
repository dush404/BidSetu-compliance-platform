"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { CountUp } from "./count-up";
import { cn } from "@/lib/utils";

/* Stat tile with count-up value + hoverable animated icon */
export function StatTile({
  label,
  value,
  icon: Icon,
  sub,
  tone = "default",
  delay = 0,
  className,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  sub?: string;
  tone?: "default" | "ok" | "warn" | "bad";
  delay?: number;
  className?: string;
}) {
  const toneCls = {
    default: "text-foreground",
    ok: "text-ok",
    warn: "text-warn",
    bad: "text-bad",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className={cn("card-hairline card-hairline-hover group p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        <motion.span
          whileHover={{ rotate: 12, scale: 1.12 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="text-muted-foreground/70 transition-colors group-hover:text-foreground"
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </motion.span>
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tracking-tight", toneCls)}>
        <CountUp to={value} delay={delay + 0.15} />
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}
