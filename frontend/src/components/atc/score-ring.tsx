"use client";

import { motion } from "framer-motion";
import { CountUp } from "./count-up";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--ok)";
  if (score >= 60) return "var(--warn)";
  if (score >= 35) return "oklch(0.64 0.15 45)";
  return "var(--bad)";
}

/* Animated compliance-score ring */
export function ScoreRing({
  score,
  size = 148,
  stroke = 11,
  label = "/100",
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Compliance score ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp
          to={score}
          delay={0.25}
          className={cn(
            "font-semibold tracking-tight",
            size >= 140 ? "text-4xl" : size >= 110 ? "text-3xl" : "text-2xl"
          )}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
