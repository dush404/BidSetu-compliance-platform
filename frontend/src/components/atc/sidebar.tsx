"use client";

import { motion } from "framer-motion";
import {
  BadgeCheck,
  ChevronUp,
  Code2,
  FileText,
  Home,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Settings,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useAppStore,
  DEFAULT_VIEW,
  ROLE_VIEWS,
  type View,
} from "@/lib/store";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Mark } from "./motion";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const ALL_NAV: Record<View, { view: View; labelKey: "nav_home" | "nav_search" | "nav_tenders" | "nav_verification" | "nav_audit" | "nav_settings"; icon: typeof Home }> = {
  home: { view: "home", labelKey: "nav_home", icon: Home },
  search: { view: "search", labelKey: "nav_search", icon: Search },
  tenders: { view: "tenders", labelKey: "nav_tenders", icon: FileText },
  tender: { view: "tender", labelKey: "nav_tenders", icon: FileText },
  bidder: { view: "bidder", labelKey: "nav_tenders", icon: FileText },
  verification: {
    view: "verification",
    labelKey: "nav_verification",
    icon: BadgeCheck,
  },
  audit: { view: "audit", labelKey: "nav_audit", icon: ScrollText },
  settings: { view: "settings", labelKey: "nav_settings", icon: Settings },
};

/** Officer sees the operational workspace; developer sees only the technical pages. */
const ROLE_NAV: Record<keyof typeof ROLE_VIEWS, View[]> = {
  OFFICER: ["home", "search", "tenders", "verification", "audit"],
  DEVELOPER: ["audit", "settings"],
};

const HEADING_KEY: Record<keyof typeof ROLE_VIEWS, "heading_workspace" | "heading_navigation"> = {
  OFFICER: "heading_workspace",
  DEVELOPER: "heading_navigation",
};

export function SidebarContent({
  onNavigate,
  collapsible = false,
}: {
  onNavigate?: () => void;
  collapsible?: boolean;
}) {
  const view = useAppStore((s) => s.view);
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const signOut = useAppStore((s) => s.signOut);
  const storeCollapsed = useAppStore((s) => s.collapsed);
  const toggleCollapsed = useAppStore((s) => s.toggleCollapsed);
  const t = useT();

  const role = user?.role ?? "OFFICER";
  const NAV = ROLE_NAV[role].map((v) => ALL_NAV[v]);
  const isDeveloper = role === "DEVELOPER";
  const isCollapsed = collapsible && storeCollapsed;

  const go = (v: View) => {
    navigate(v);
    onNavigate?.();
  };

  const handleSignOut = () => {
    void api.logout().catch(() => null);
    signOut();
    onNavigate?.();
    toast(t("sign_out"), { description: t("sign_out_sub") });
  };

  const profile = (
    <p className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-[13px] font-medium">
        {user?.name ?? "Officer"}
      </span>
      {isDeveloper && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted px-1.5 py-px text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Code2 className="size-2.5" />
          Dev
        </span>
      )}
    </p>
  );

  return (
    <div className="flex h-full flex-col">
      {/* wordmark + collapse toggle */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 pt-6 pb-7",
          isCollapsed && "flex-col px-3"
        )}
      >
        <button
          onClick={() => go(DEFAULT_VIEW[role])}
          aria-label={t("nav_home")}
          className={cn(
            "flex items-center gap-3 text-left",
            isCollapsed && "justify-center"
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
            <Mark className="size-5.5" />
          </span>
          {!isCollapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight">
                AI Tender Compliance
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {t("gov_procurement")}
              </span>
            </span>
          )}
        </button>

        {collapsible && (
          <button
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? t("expand_sidebar") : t("collapse_sidebar")}
            title={isCollapsed ? t("expand_sidebar") : t("collapse_sidebar")}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground",
              !isCollapsed && "ml-auto"
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        )}
      </div>

      {/* nav */}
      <nav
        className={cn("flex-1 space-y-1 px-3", isCollapsed && "px-3.5")}
        aria-label="Primary"
      >
        {!isCollapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground/80 uppercase">
            {t(HEADING_KEY[role])}
          </p>
        )}
        {isCollapsed && <div className="pb-2" />}
        {NAV.map(({ view: v, labelKey, icon: Icon }) => {
          const active = view === v;
          const label = t(labelKey);
          return (
            <button
              key={v}
              onClick={() => go(v)}
              aria-current={active ? "page" : undefined}
              title={isCollapsed ? label : undefined}
              className={cn(
                "group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                isCollapsed && "justify-center px-0",
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-border bg-card shadow-[0_1px_3px_oklch(0.245_0.014_105/0.05)]"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex flex-1 items-center gap-3",
                  isCollapsed && "flex-none"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 transition-transform duration-300 group-hover:scale-110",
                    isCollapsed && "size-4.5",
                    active ? "text-primary" : ""
                  )}
                  strokeWidth={active ? 2 : 1.75}
                />
                {!isCollapsed && label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* footer */}
      <div className={cn("space-y-3 px-4 pb-5", isCollapsed && "px-3.5")}>
        {!isCollapsed && (
          <div className="rounded-xl border border-warn/25 bg-warn-soft/60 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-warn">
              <Zap className="size-3.5" />
              {t("demo_mode")}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("demo_sub")}
            </p>
          </div>
        )}

        {/* profile — opens a compact account popover */}
        <Popover>
          <PopoverTrigger asChild>
            {isCollapsed ? (
              <button
                aria-label={t("account")}
                title={t("account")}
                className="mx-auto flex size-10 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-105"
              >
                {initials(user?.name ?? "Officer")}
              </button>
            ) : (
              <button
                aria-label={t("account")}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-primary-foreground">
                  {initials(user?.name ?? "Officer")}
                </span>
                <span className="min-w-0 flex-1">
                  {profile}
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {user?.email ?? "officer@gov.in"}
                  </span>
                </span>
                <ChevronUp className="size-3.5 text-muted-foreground/60" />
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent
            side={isCollapsed ? "right" : "top"}
            align={isCollapsed ? "center" : "start"}
            sideOffset={10}
            className="w-[264px] p-0"
          >
            <div className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-primary-foreground">
                  {initials(user?.name ?? "Officer")}
                </span>
                <div className="min-w-0 flex-1">
                  {profile}
                  <p className="truncate text-[11px] text-muted-foreground">
                    {user?.email ?? "officer@gov.in"}
                  </p>
                </div>
              </div>
              <dl className="mt-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">
                    {t("department")}
                  </dt>
                  <dd className="truncate font-medium">
                    {user?.department ?? "Dept. of Procurement"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">
                    {t("location")}
                  </dt>
                  <dd className="flex min-w-0 items-center gap-1 truncate font-medium">
                    <MapPin className="size-3 shrink-0 text-primary" />
                    {user?.location ??
                      (isDeveloper ? "Bengaluru, India" : "New Delhi, India")}
                  </dd>
                </div>
              </dl>
            </div>
            <button
              onClick={handleSignOut}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-b-xl bg-muted/60 text-[13px] font-medium text-bad transition-colors hover:bg-bad-soft"
            >
              <LogOut className="size-3.5" />
              {t("sign_out")}
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
