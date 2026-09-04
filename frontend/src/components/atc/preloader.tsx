"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Mark, EASE } from "./motion";

const WORD = "AI Tender Compliance";

/* Cinematic initial page load: drawn mark, letter stagger, counter, curtain lift */
export function Preloader({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let p = 0;
    const id = window.setInterval(() => {
      p += Math.random() * 14 + 6;
      if (p >= 100) {
        p = 100;
        window.clearInterval(id);
        window.setTimeout(onDone, 420);
      }
      setProgress(Math.floor(p));
    }, 130);
    return () => window.clearInterval(id);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
      exit={{ y: "-100%", transition: { duration: 0.75, ease: EASE } }}
      aria-label="Loading application"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-col items-center"
      >
        <Mark animated className="size-14 text-foreground" />

        <div className="mt-6 flex overflow-hidden" aria-label={WORD}>
          {WORD.split("").map((ch, i) => (
            <motion.span
              key={i}
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.28 + i * 0.028, ease: EASE }}
              className="font-display text-2xl tracking-tight text-foreground sm:text-3xl"
            >
              {ch === " " ? "\u00A0" : ch}
            </motion.span>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-2 text-[11px] font-medium tracking-[0.32em] text-muted-foreground uppercase"
        >
          Government Procurement Platform
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="absolute bottom-14 flex w-56 flex-col items-center gap-3"
      >
        <div className="h-px w-full overflow-hidden bg-border">
          <motion.div
            className="h-full bg-foreground"
            animate={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: 0.25 }}
          />
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {String(progress).padStart(3, "0")}%
        </span>
      </motion.div>
    </motion.div>
  );
}
