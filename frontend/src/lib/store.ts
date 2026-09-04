"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SessionUser } from "./types";
import type { Lang } from "./i18n";

export type View =
  | "home"
  | "search"
  | "tenders"
  | "tender"
  | "bidder"
  | "verification"
  | "audit"
  | "settings";

export type AppRole = SessionUser["role"];

/**
 * Role-based access control.
 * - Procurement Officer → the operational workspace only (no technical pages).
 * - Developer → technical console only: Audit Logs + Platform Settings.
 * Tender/bidder detail views inherit the officer workspace permission.
 */
export const ROLE_VIEWS: Record<AppRole, View[]> = {
  OFFICER: ["home", "search", "tenders", "tender", "bidder", "verification", "audit"],
  DEVELOPER: ["settings", "audit"],
};

export const DEFAULT_VIEW: Record<AppRole, View> = {
  OFFICER: "home",
  DEVELOPER: "settings",
};

export function isViewAllowed(role: AppRole | undefined, view: View): boolean {
  if (!role) return false;
  return ROLE_VIEWS[role].includes(view);
}

export type AiMode = "cloud" | "local" | "fallback";

export type Stage = "preload" | "auth" | "app";

export interface NavParams {
  tenderId?: string;
  tenderLabel?: string;
  bidderId?: string;
  bidderLabel?: string;
}

export interface NavEntry extends NavParams {
  view: View;
}

export interface RecentTender {
  id: string;
  code: string;
  title: string;
}

interface AppState {
  stage: Stage;
  user: SessionUser | null;
  view: View;
  tenderId?: string;
  tenderLabel?: string;
  bidderId?: string;
  bidderLabel?: string;
  canGoBack: boolean;
  commandOpen: boolean;
  recent: RecentTender[];
  history: NavEntry[];
  aiMode: AiMode;
  collapsed: boolean;
  lang: Lang;

  toggleCollapsed: () => void;
  setLang: (l: Lang) => void;
  finishPreload: () => void;
  setUser: (u: SessionUser | null) => void;
  signOut: () => void;
  navigate: (view: View, params?: NavParams) => void;
  replace: (view: View, params?: NavParams) => void;
  back: () => void;
  setCommandOpen: (v: boolean) => void;
  pushRecent: (t: RecentTender) => void;
  setAiMode: (m: AiMode) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      stage: "preload",
      user: null,
      view: "home",
      tenderId: undefined,
      tenderLabel: undefined,
      bidderId: undefined,
      bidderLabel: undefined,
      canGoBack: false,
      commandOpen: false,
      recent: [],
      history: [],
      aiMode: "cloud",
      collapsed: false,
      lang: "en",

      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),

      setLang: (lang) => set({ lang }),

      finishPreload: () => {
        const { user } = get();
        set({ stage: user ? "app" : "auth" });
      },

      setUser: (user) =>
        set({
          user,
          stage: user ? "app" : "auth",
          // Land each role on its own home base and drop stale context.
          view: user ? DEFAULT_VIEW[user.role] : "home",
          tenderId: undefined,
          tenderLabel: undefined,
          bidderId: undefined,
          bidderLabel: undefined,
          history: [],
          canGoBack: false,
        }),

      signOut: () =>
        set({
          user: null,
          stage: "auth",
          view: "home",
          tenderId: undefined,
          bidderId: undefined,
          history: [],
          canGoBack: false,
        }),

      navigate: (view, params) => {
        const s = get();
        // RBAC clamp — a role can never navigate outside its own views.
        if (s.user && !isViewAllowed(s.user.role, view)) {
          view = DEFAULT_VIEW[s.user.role];
          params = undefined;
        }
        const current: NavEntry = {
          view: s.view,
          tenderId: s.tenderId,
          tenderLabel: s.tenderLabel,
          bidderId: s.bidderId,
          bidderLabel: s.bidderLabel,
        };
        const history = [...s.history, current].slice(-24);
        set({
          view,
          tenderId: params?.tenderId,
          tenderLabel: params?.tenderLabel,
          bidderId: params?.bidderId,
          bidderLabel: params?.bidderLabel,
          history,
          canGoBack: true,
        });
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      },

      replace: (view, params) => {
        const s = get();
        if (s.user && !isViewAllowed(s.user.role, view)) {
          view = DEFAULT_VIEW[s.user.role];
          params = undefined;
        }
        set({
          view,
          tenderId: params?.tenderId,
          tenderLabel: params?.tenderLabel,
          bidderId: params?.bidderId,
          bidderLabel: params?.bidderLabel,
        });
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      },

      back: () => {
        const s = get();
        const fallback = s.user ? DEFAULT_VIEW[s.user.role] : "home";
        if (s.history.length === 0) {
          set({ view: fallback, bidderId: undefined, bidderLabel: undefined });
          return;
        }
        const prev = s.history[s.history.length - 1];
        if (s.user && !isViewAllowed(s.user.role, prev.view)) {
          set({
            view: fallback,
            bidderId: undefined,
            bidderLabel: undefined,
            history: s.history.slice(0, -1),
          });
          return;
        }
        set({
          view: prev.view,
          tenderId: prev.tenderId,
          tenderLabel: prev.tenderLabel,
          bidderId: prev.bidderId,
          bidderLabel: prev.bidderLabel,
          history: s.history.slice(0, -1),
          canGoBack: s.history.length > 1,
        });
      },

      setCommandOpen: (commandOpen) => set({ commandOpen }),

      setAiMode: (aiMode) => set({ aiMode }),

      pushRecent: (t) => {
        const { recent } = get();
        const next = [t, ...recent.filter((r) => r.id !== t.id)].slice(0, 6);
        set({ recent: next });
      },
    }),
    {
      name: "atc-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        user: s.user,
        recent: s.recent,
        aiMode: s.aiMode,
        collapsed: s.collapsed,
        lang: s.lang,
      }),
    }
  )
);
