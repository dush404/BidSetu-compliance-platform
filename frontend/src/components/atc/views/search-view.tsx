"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Clock3,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { Tender } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Reveal, Stagger, StaggerItem, EASE } from "../motion";
import { StatusPill } from "../status-pill";
import { RowListSkeleton } from "../skeletons";
import { EmptyState } from "../empty-state";

export function SearchView() {
  const navigate = useAppStore((s) => s.navigate);
  const recent = useAppStore((s) => s.recent);
  const pushRecent = useAppStore((s) => s.pushRecent);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tender[] | null>(null);
  const [all, setAll] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getTenders()
      .then((r) => setAll(r.tenders))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      try {
        const r = await api.getTenders(query.trim());
        setResults(r.tenders);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const open = (t: Tender) => {
    pushRecent({ id: t.id, code: t.code, title: t.title });
    navigate("tender", { tenderId: t.id, tenderLabel: t.code });
  };

  const showing = query.trim() ? results : all;

  return (
    <div className="space-y-8">
      {/* hero */}
      <div className="pt-4 pb-2 text-center sm:pt-10">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Search className="size-3.5 text-primary" />
            Tender Discovery
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">
            Find a <em className="text-primary">tender</em>.
          </h1>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-muted-foreground">
            Search by tender name, ID or ministry — then review its bidders
            and verification results.
          </p>
        </Reveal>

        {/* search input */}
        <Reveal delay={0.2}>
          <div className="mx-auto mt-7 max-w-2xl">
            <div className="group relative">
              <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. TND-2024-003 or “medical equipment”"
                aria-label="Search tenders"
                className="card-hairline h-14 w-full pr-14 pl-13 text-[15px] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_9%,transparent)]"
              />
              <AnimatePresence>
                {query && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-4 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>

      {/* recently viewed */}
      {recent.length > 0 && !query.trim() && (
        <Reveal delay={0.24}>
          <section aria-label="Recently viewed" className="mx-auto max-w-2xl">
            <p className="mb-2.5 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Recently viewed
            </p>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={r.id}
                  onClick={() =>
                    navigate("tender", { tenderId: r.id, tenderLabel: r.code })
                  }
                  className="group flex min-h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] transition-all hover:border-primary/40 hover:bg-accent/50"
                >
                  <Clock3 className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                  <span className="max-w-44 truncate font-medium">{r.title}</span>
                </button>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* results */}
      <div className="mx-auto max-w-3xl">
        {loading && <RowListSkeleton rows={3} />}

        {!loading && error && (
          <p className="card-hairline p-6 text-center text-sm text-bad">
            Could not reach the tender service. Please try again.
          </p>
        )}

        {!loading && !error && showing && showing.length === 0 && query.trim() && (
          <EmptyState
            icon={SearchX}
            title="No tenders matched"
            hint={`Nothing found for “${query.trim()}”. Try a different name or ID.`}
          />
        )}

        {!loading && !error && showing && showing.length > 0 && (
          <>
            <p className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              {query.trim()
                ? `${showing.length} result${showing.length > 1 ? "s" : ""}`
                : "All tenders"}
            </p>
            <Stagger className="space-y-3">
              <AnimatePresence initial={false}>
                {showing.map((t) => (
                  <StaggerItem key={t.id}>
                    <motion.button
                      layout
                      onClick={() => open(t)}
                      className="card-hairline card-hairline-hover group flex w-full items-center gap-4 p-4 text-left"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                        <Building2 className="size-4.5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {t.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          <span className="font-mono">{t.code}</span> · {t.department} ·{" "}
                          {t.bidderCount} bidder{t.bidderCount !== 1 ? "s" : ""}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                        <StatusPill kind={t.status} />
                        <span className="mt-1 block">Closes {fmtDate(t.closesAt)}</span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                    </motion.button>
                  </StaggerItem>
                ))}
              </AnimatePresence>
            </Stagger>
          </>
        )}
      </div>
    </div>
  );
}
