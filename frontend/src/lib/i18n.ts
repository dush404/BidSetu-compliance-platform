"use client";

import { useCallback } from "react";
import { useAppStore } from "./store";

/* ——— Lightweight i18n for the platform chrome ———
   English + Hindi. View-level content stays English for now;
   navigation, topbar and account surfaces follow the chosen language. */

export type Lang = "en" | "hi";

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    nav_home: "Home",
    nav_search: "Tender Search",
    nav_tenders: "Tenders",
    nav_verification: "Verification",
    nav_audit: "Audit Logs",
    nav_settings: "Settings",
    heading_workspace: "Workspace",
    heading_navigation: "Navigation",
    gov_procurement: "Government Procurement",
    demo_mode: "Demo mode",
    demo_sub: "Simulated government databases",
    sign_out: "Sign out",
    sign_out_sub: "Your session was closed safely.",
    search_ph: "Search…",
    notifications: "Notifications",
    recent_activity: "Recent activity",
    nothing_yet: "Nothing yet.",
    view_audit_log: "View full audit log",
    department: "Department",
    location: "Location",
    collapse_sidebar: "Collapse sidebar",
    expand_sidebar: "Expand sidebar",
    open_nav: "Open navigation",
    search_aria: "Search",
    language: "Language",
    light_mode: "Switch to light mode",
    dark_mode: "Switch to dark mode",
    lang_updated: "Language updated",
    account: "Account",
  },
  hi: {
    nav_home: "होम",
    nav_search: "टेंडर खोज",
    nav_tenders: "टेंडर",
    nav_verification: "सत्यापन",
    nav_audit: "ऑडिट लॉग",
    nav_settings: "सेटिंग्स",
    heading_workspace: "कार्यक्षेत्र",
    heading_navigation: "नेविगेशन",
    gov_procurement: "सरकारी खरीद",
    demo_mode: "डेमो मोड",
    demo_sub: "सिम्युलेटेड सरकारी डेटाबेस",
    sign_out: "साइन आउट",
    sign_out_sub: "आपका सेशन सुरक्षित बंद हो गया।",
    search_ph: "खोजें…",
    notifications: "सूचनाएँ",
    recent_activity: "हाल की गतिविधि",
    nothing_yet: "अभी कुछ नहीं।",
    view_audit_log: "पूरा ऑडिट लॉग देखें",
    department: "विभाग",
    location: "स्थान",
    collapse_sidebar: "साइडबार संकुचित करें",
    expand_sidebar: "साइडबार विस्तारित करें",
    open_nav: "नेविगेशन खोलें",
    search_aria: "खोजें",
    language: "भाषा",
    light_mode: "लाइट मोड पर जाएँ",
    dark_mode: "डार्क मोड पर जाएँ",
    lang_updated: "भाषा बदल दी गई",
    account: "खाता",
  },
};

export type TKey = keyof typeof DICT.en;

export function translate(lang: Lang, key: TKey): string {
  return DICT[lang]?.[key] ?? DICT.en[key] ?? key;
}

/** Hook returning a translator bound to the persisted language preference. */
export function useT() {
  const lang = useAppStore((s) => s.lang);
  return useCallback((key: TKey) => translate(lang, key), [lang]);
}

export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी",
};
