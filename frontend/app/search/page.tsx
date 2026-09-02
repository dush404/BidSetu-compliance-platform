"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Search, Clock, ArrowRight, FileText, Building2, Calendar, Users, ChevronRight, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { cn, formatDate } from "@/lib/utils";

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

type Tender = {
  id: number;
  
    title: string;
    tenderId: string;
    statusId: string;
    bidderCount: number;
    department?: string;
    closingDate?: string;
    publishedDate?: string;
    createdAtDate?: string;
    description?: any;
};

const RECENT_KEY = "atc_recent_searches";
const RECENT_TENDERS_KEY = "atc_recent_tenders";

function getRecent<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveRecent<T>(key: string, value: T, max = 5) {
  const existing: T[] = getRecent(key);
  const filtered = existing.filter((v: any) =>
    JSON.stringify(v) !== JSON.stringify(value)
  );
  localStorage.setItem(key, JSON.stringify([value, ...filtered].slice(0, max)));
}

export default function SearchPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentTenders, setRecentTenders] = useState<{ id: number; title: string; tenderId: string }[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentSearches(getRecent<string>(RECENT_KEY));
    setRecentTenders(getRecent<{ id: number; title: string; tenderId: string }>(RECENT_TENDERS_KEY));
  }, []);

  const doSearch = async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setFocused(false);

    saveRecent<string>(RECENT_KEY, term);
    setRecentSearches(getRecent<string>(RECENT_KEY));

    try {
      // Search by title OR tenderId
      const res = await axios.get(
        `${STRAPI}/api/tenders?filters[$or][0][title][$containsi]=${encodeURIComponent(term)}&filters[$or][1][tenderId][$containsi]=${encodeURIComponent(term)}&populate=*`
      );
      setTenders(res.data.data || []);
    } catch {
      setTenders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(searchTerm);
  };

  const handleTenderClick = (tender: Tender) => {
    saveRecent(RECENT_TENDERS_KEY, {
      id: tender.id,
      title: tender.title,
      tenderId: tender.tenderId,
    });
    router.push(`/tender/${tender.id}`);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setTenders([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  return (
    <AppShell title="Find a Tender" breadcrumb={[{ label: "Home" }, { label: "Tender Search" }]}>
      <div className="max-w-4xl mx-auto">
        {/* Page header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy-50 border border-navy-100 mb-4">
            <Search className="w-3 h-3 text-navy-700" />
            <span className="text-xs font-semibold text-navy-700">Tender Discovery</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Find a Tender</h1>
          <p className="text-sm text-gray-500 max-w-lg mx-auto">
            Search and review tender submissions for compliance verification. Enter a tender name or ID to get started.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-8">
          <form onSubmit={handleSubmit}>
            <div className={cn(
              "relative flex items-center bg-white rounded-xl border transition-all duration-200 shadow-card",
              focused ? "border-navy-500 ring-2 ring-navy-500/20 shadow-elevated" : "border-gray-200 hover:border-gray-300"
            )}>
              <Search className="absolute left-4 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                placeholder="Search by Tender Name or Tender ID (e.g. TND-2024-001)"
                className="flex-1 pl-11 pr-4 py-3.5 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="p-1.5 mr-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !searchTerm.trim()}
                className="m-1.5 px-5 py-2 bg-navy-900 text-white text-sm font-semibold rounded-lg
                  hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>Search</>
                )}
              </button>
            </div>

            {/* Recent searches dropdown */}
            {focused && !searchTerm && recentSearches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-elevated z-20 overflow-hidden animate-slide-up">
                <div className="px-4 py-2 border-b border-gray-100">
                  <span className="section-label">Recent Searches</span>
                </div>
                {recentSearches.map((term, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left transition-colors"
                    onMouseDown={() => {
                      setSearchTerm(term);
                      doSearch(term);
                    }}
                  >
                    <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="flex-1">{term}</span>
                    <ArrowRight className="w-3 h-3 text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                {loading ? "Searching..." : `${tenders.length} tender${tenders.length !== 1 ? "s" : ""} found`}
              </h2>
              {!loading && searchTerm && (
                <span className="text-xs text-gray-400">for &quot;{searchTerm}&quot;</span>
              )}
            </div>

            {!loading && tenders.length === 0 && (
              <Card className="text-center py-12">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">No tenders found</p>
                <p className="text-xs text-gray-400 mt-1">Try a different name or Tender ID</p>
              </Card>
            )}

            {tenders.map((tender) => (
              <TenderRow key={tender.id} tender={tender} onClick={() => handleTenderClick(tender)} />
            ))}
          </div>
        )}

        {/* Recent tenders (shown when no search active) */}
        {!hasSearched && recentTenders.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Recently Viewed
            </h2>
            <div className="grid gap-2">
              {recentTenders.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/tender/${t.id}`)}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-card hover:shadow-card-hover hover:border-gray-200 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-navy-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{t.title}</div>
                    <div className="text-xs text-gray-400">{t.tenderId}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty home state */}
        {!hasSearched && recentTenders.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-navy-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Start your search</h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              Enter a tender name or ID above to find and verify bidder submissions
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md mx-auto text-left">
              {[
                { icon: Search, label: "Search by ID", desc: "TND-2024-001" },
                { icon: Building2, label: "Search by Org", desc: "Ministry, Department" },
                { icon: Users, label: "View Bidders", desc: "Run Verification" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="p-3 bg-white rounded-xl border border-gray-100 text-center">
                  <Icon className="w-4 h-4 text-navy-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-gray-700">{label}</div>
                  <div className="text-2xs text-gray-400 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TenderRow({ tender, onClick }: { tender: Tender; onClick: () => void }) {
  const { title, tenderId, statusId, bidderCount, department, closingDate, publishedDate } = tender;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-card hover:shadow-card-hover hover:border-gray-200 cursor-pointer transition-all duration-150 mb-2 group animate-slide-up"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-navy-600" />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 truncate">{title}</span>
          <StatusBadge status={statusId || "Open"} />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="font-mono font-medium text-gray-500">{tenderId}</span>
          {department && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {department}
              </span>
            </>
          )}
          {closingDate && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Closes {formatDate(closingDate)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bidder count */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
        <Users className="w-3.5 h-3.5 text-gray-400" />
        <span className="font-semibold text-gray-700">{bidderCount ?? "—"}</span>
        <span className="text-gray-400">bidders</span>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
    </div>
  );
}
