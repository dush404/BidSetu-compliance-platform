"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const emptySubscribe = () => () => {};

/* Animated light / dark mode switch — sun and moon crossfade + rotate. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  /* Hydration-safe "mounted" flag without setState-in-effect. */
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex size-10 items-center justify-center overflow-hidden rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "moon" : "sun"}
          initial={{ rotate: -100, opacity: 0, scale: 0.55 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 100, opacity: 0, scale: 0.55 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex"
        >
          {dark ? (
            <Moon className="size-4" strokeWidth={1.75} />
          ) : (
            <Sun className="size-4" strokeWidth={1.75} />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
