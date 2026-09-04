"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { Preloader } from "@/components/atc/preloader";
import { LoginView } from "@/components/atc/login-view";
import { AppShell } from "@/components/atc/app-shell";

export default function Page() {
  const stage = useAppStore((s) => s.stage);
  const finishPreload = useAppStore((s) => s.finishPreload);

  /* Lock scroll while the preloader curtain is up */
  useEffect(() => {
    document.body.style.overflow = stage === "preload" ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [stage]);

  return (
    <AnimatePresence mode="wait">
      {stage === "preload" && <Preloader key="preloader" onDone={finishPreload} />}

      {stage === "auth" && (
        <motion.div
          key="auth"
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <LoginView />
        </motion.div>
      )}

      {stage === "app" && (
        <motion.div
          key="app"
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <AppShell />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
