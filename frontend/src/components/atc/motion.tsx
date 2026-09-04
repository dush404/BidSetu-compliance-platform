"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* Fade-up entrance on mount */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(5px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE },
  },
};

export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerChild} className={className}>
      {children}
    </motion.div>
  );
}

/* Animated brand shield mark — draws itself in */
export function Mark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-6", className)}
      aria-hidden="true"
    >
      <path
        d="M16 2.75 L27.25 7.25 V15.5 C27.25 22.6 22.6 27.5 16 29.25 C9.4 27.5 4.75 22.6 4.75 15.5 V7.25 Z"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinejoin="round"
        className={animated ? "draw-path-slow" : undefined}
      />
      <path
        d="M11.4 15.9 L14.7 19.3 L20.9 12.5"
        stroke="var(--primary)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? "draw-path" : undefined}
        style={animated ? { animationDelay: "0.5s" } : undefined}
      />
    </svg>
  );
}
