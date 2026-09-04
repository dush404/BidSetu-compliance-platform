"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine, Loader2, FileImage, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExtractedData {
  company_name?: string;
  gstin?: string;
  pan?: string;
  udyam_id?: string;
  registration_date?: string;
  status?: string;
}

interface QuickVerification {
  compliance_score?: number;
  risk_level?: string;
  status?: string;
  details?: Record<string, string>;
  matched_bidder?: string | null;
}

interface ExtractResponse {
  filename: string;
  extracted_data: ExtractedData;
  verification_result: QuickVerification;
  source: string;
}

/**
 * "Scan with AI" — uploads a certificate image to the Python AI worker's
 * Gemini vision endpoint (/extract) and shows the extracted fields plus
 * the quick compliance pre-check.
 */
export function AiDocScan() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);

  const pick = () => inputRef.current?.click();

  const onFile = async (file: File) => {
    setScanning(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg: string = data?.error ?? `Scan failed (${res.status})`;
        if (res.status === 503) {
          toast.error("AI vision not configured", {
            description:
              "Add GEMINI_API_KEY to mini-services/ai-worker/.env and restart the worker.",
          });
        } else {
          toast.error("Document scan failed", { description: msg });
        }
        return;
      }
      setResult(data as ExtractResponse);
    } catch {
      toast.error("Document scan failed", {
        description: "Could not reach the AI worker.",
      });
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Upload certificate image for AI scan"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      <button
        onClick={pick}
        disabled={scanning}
        className={cn(
          "group relative flex min-h-9 items-center gap-2 overflow-hidden rounded-full border border-border bg-card px-4 text-xs font-medium text-foreground transition-all",
          "hover:border-foreground/30 hover:bg-muted disabled:opacity-70"
        )}
      >
        {scanning ? (
          <>
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span className="bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent [animation:shimmer_1.4s_linear_infinite]">
              Scanning with AI…
            </span>
          </>
        ) : (
          <>
            <ScanLine className="size-3.5 text-primary transition-transform duration-300 group-hover:scale-110" />
            Scan with AI
          </>
        )}
        {scanning && (
          <motion.span
            aria-hidden
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
          />
        )}
      </button>

      <Dialog open={result !== null} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border bg-accent/40 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <ScanLine className="size-4.5 text-primary" />
              AI document scan
            </DialogTitle>
            <DialogDescription className="text-xs">
              {result?.filename} · extracted by {result?.source}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
              {/* extracted fields */}
              <section>
                <h4 className="mb-2.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Extracted data
                </h4>
                <dl className="grid grid-cols-[1fr_1.4fr] gap-x-4 gap-y-1.5 text-[13px]">
                  {[
                    ["Company", result.extracted_data.company_name],
                    ["GSTIN", result.extracted_data.gstin],
                    ["PAN", result.extracted_data.pan],
                    ["Udyam ID", result.extracted_data.udyam_id],
                    ["Registration", result.extracted_data.registration_date],
                    ["Status", result.extracted_data.status],
                  ].map(([k, v]) => (
                    <div key={k as string} className="contents">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className={cn("font-medium", !v && "text-muted-foreground/60")}>
                        {v || "not found"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* quick verification */}
              {result.verification_result && (
                <section className="border-t border-border pt-4">
                  <h4 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                    <ShieldCheck className="size-3.5 text-primary" />
                    Quick compliance pre-check
                  </h4>
                  <div className="mb-3 flex items-center gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border font-display text-xl">
                      {result.verification_result.compliance_score ?? "—"}
                    </div>
                    <div className="text-[13px] leading-snug">
                      <p className="font-semibold">{result.verification_result.status}</p>
                      <p className="text-muted-foreground">
                        Risk level: {result.verification_result.risk_level ?? "—"}
                        {result.verification_result.matched_bidder
                          ? ` · matched: ${result.verification_result.matched_bidder}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <dl className="space-y-1.5 text-[13px]">
                    {Object.entries(result.verification_result.details ?? {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground capitalize">
                          {k.replace(/_/g, " ")}
                        </dt>
                        <dd
                          className={cn(
                            "font-medium",
                            v.toLowerCase().startsWith("pass")
                              ? "text-ok"
                              : v.toLowerCase().startsWith("fail")
                                ? "text-bad"
                                : "text-foreground"
                          )}
                        >
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <p className="flex items-start gap-2 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                <FileImage className="mt-0.5 size-3.5 shrink-0" />
                Scans run against the simulated government registries. Full verification
                remains available from the bidder profile.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
