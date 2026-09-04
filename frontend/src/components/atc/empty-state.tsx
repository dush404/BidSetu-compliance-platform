"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Elegant centered empty state with a floating icon */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      <div className="animate-floaty flex size-16 items-center justify-center rounded-full border border-dashed border-border bg-muted/50">
        <Icon className="size-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="font-display mt-5 text-xl text-foreground">{title}</p>
      {hint && (
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{hint}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
