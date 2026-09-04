"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  AtSign,
  Code2,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Mark, Reveal, EASE } from "./motion";
import { cn } from "@/lib/utils";

const MARQUEE = ["Secure", "Auditable", "Transparent", "Accountable", "Efficient"];

type Role = "OFFICER" | "DEVELOPER";

export function LoginView() {
  const setUser = useAppStore((s) => s.setUser);
  const [role, setRole] = useState<Role>("OFFICER");
  const [email, setEmail] = useState("officer@gov.in");
  const [password, setPassword] = useState("demo1234");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOfficer = role === "OFFICER";

  const switchRole = (r: Role) => {
    setRole(r);
    setEmail(r === "OFFICER" ? "officer@gov.in" : "developer@example.com");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter your ID and password to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.login({ email: email.trim(), password, role });
      setDone(true);
      toast.success(`Signed in as ${res.user.name}`, {
        description: "Welcome back to the compliance platform.",
      });
      window.setTimeout(() => setUser(res.user), 650);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="grid w-full flex-1 lg:grid-cols-[1.05fr_1fr]">
        {/* ——— Brand panel ——— */}
        <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
          {/* soft radial wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(52rem 30rem at 12% 8%, color-mix(in oklch, var(--primary) 9%, transparent), transparent 62%), radial-gradient(40rem 28rem at 88% 96%, color-mix(in oklch, var(--warn) 7%, transparent), transparent 60%)",
            }}
          />
          <Reveal className="relative">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                <Mark className="size-6" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">AI Tender Compliance</p>
                <p className="text-xs text-muted-foreground">Government Procurement Platform</p>
              </div>
            </div>
          </Reveal>

          <div className="relative max-w-xl">
            <Reveal delay={0.1}>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                <ShieldCheck className="size-3.5 text-ok" />
                Simulated government databases · audit-ready by design
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <h1 className="font-display text-5xl leading-[1.08] tracking-tight xl:text-6xl">
                Smarter compliance,
                <br />
                <em className="text-primary">done calmly.</em>
              </h1>
            </Reveal>
            <Reveal delay={0.28}>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Verify bidder documents, surface risk early, and keep every
                procurement decision transparent — in one quiet, focused
                workspace.
              </p>
            </Reveal>
            <Reveal delay={0.38} className="mt-10">
              <div className="grid max-w-md grid-cols-3 gap-3">
                {[
                  { k: "GST · PAN · MSME", v: "Registry checks" },
                  { k: "AI risk summary", v: "Every bidder" },
                  { k: "Officer decisions", v: "Fully logged" },
                ].map((f) => (
                  <div key={f.k} className="card-hairline p-3.5">
                    <p className="text-[13px] font-medium">{f.k}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{f.v}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* marquee — full-bleed to the true left edge of the screen */}
          <div className="relative -mx-12 -mb-12 overflow-hidden py-4">
            <div className="animate-marquee flex w-max items-center gap-8 pr-8">
              {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((w, i) => (
                <span
                  key={i}
                  className="flex items-center gap-8 text-[11px] font-medium tracking-[0.3em] text-muted-foreground/70 uppercase"
                >
                  {w}
                  <Landmark className="size-3" />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ——— Form panel ——— */}
        <div className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center lg:py-12">
          <div className="mx-auto w-full max-w-md">
            {/* compact brand for mobile */}
            <Reveal className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-card">
                <Mark className="size-5.5" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">AI Tender Compliance</p>
                <p className="text-[11px] text-muted-foreground">Government Procurement Platform</p>
              </div>
            </Reveal>

            {/* role toggle */}
            <Reveal delay={0.05}>
              <div className="relative mb-9 inline-flex rounded-full border border-border bg-card p-1">
                {(
                  [
                    { r: "OFFICER" as Role, label: "Procurement Officer", icon: Landmark },
                    { r: "DEVELOPER" as Role, label: "Developer", icon: Code2 },
                  ]
                ).map(({ r, label, icon: Icon }) => {
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => switchRole(r)}
                      className={cn(
                        "relative flex min-h-9 items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="role-pill"
                          className="absolute inset-0 rounded-full bg-secondary shadow-[0_1px_2px_oklch(0.245_0.014_105/0.06)]"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className={cn("size-3.5", active && "text-primary")} />
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Reveal>

            <AnimatePresence mode="wait">
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
                  {isOfficer ? "Welcome back." : "Developer access."}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {isOfficer
                    ? "Sign in to review tenders and make confident procurement decisions."
                    : "Sign in to explore platform APIs and integration tooling."}
                </p>

                <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
                  <div>
                    <label
                      htmlFor="login-id"
                      className="mb-1.5 block text-[13px] font-medium"
                    >
                      {isOfficer ? "Officer ID or email" : "Developer email"}
                    </label>
                    <div className="group relative">
                      <AtSign className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <input
                        id="login-id"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@gov.in"
                        className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-[15px] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="login-pw" className="block text-[13px] font-medium">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          toast.info("Demo environment", {
                            description: "Any credentials work — data is simulated.",
                          })
                        }
                        className="min-h-6 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="group relative">
                      <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <input
                        id="login-pw"
                        type={showPw ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="h-12 w-full rounded-xl border border-input bg-card pr-11 pl-10 text-[15px] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[13px] font-medium text-bad"
                      role="alert"
                    >
                      {error}
                    </motion.p>
                  )}

                  <motion.button
                    type="submit"
                    disabled={submitting || done}
                    whileTap={{ scale: 0.985 }}
                    className={cn(
                      "group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[15px] font-medium text-primary-foreground transition-all",
                      "hover:shadow-[0_8px_24px_-8px_oklch(0.245_0.014_105/0.4)] disabled:opacity-90",
                      done && "bg-ok"
                    )}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {submitting ? (
                        <motion.span
                          key="loading"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="flex items-center gap-2"
                        >
                          <Loader2 className="size-4 animate-spin" />
                          Signing in…
                        </motion.span>
                      ) : done ? (
                        <motion.span
                          key="done"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-2"
                        >
                          <ShieldCheck className="size-4" />
                          Signed in
                        </motion.span>
                      ) : (
                        <motion.span
                          key="idle"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="flex items-center gap-2"
                        >
                          Sign in as {isOfficer ? "Procurement Officer" : "Developer"}
                          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>

                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    Demo environment — any credentials work.
                  </p>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
