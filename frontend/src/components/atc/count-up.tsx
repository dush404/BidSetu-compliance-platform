"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* Animated number count-up with ease-out cubic */
export function CountUp({
  to,
  duration = 1.1,
  delay = 0,
  suffix,
  prefix,
  className,
}: {
  to: number;
  duration?: number;
  delay?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    let start: number | null = null;
    const total = duration * 1000;
    const delayMs = delay * 1000;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start - delayMs;
      if (elapsed < 0) {
        raf.current = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, elapsed / total);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration, delay]);

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {val}
      {suffix}
    </span>
  );
}
