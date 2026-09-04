"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  FileText,
  Home,
  ScrollText,
  Search,
  Settings,
  Clock3,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import {
  useAppStore,
  ROLE_VIEWS,
  type View,
} from "@/lib/store";
import type { Tender } from "@/lib/types";

const ALL_PAGES: { view: View; label: string; icon: typeof Home }[] = [
  { view: "home", label: "Overview", icon: Home },
  { view: "search", label: "Tender Search", icon: Search },
  { view: "tenders", label: "All Tenders", icon: FileText },
  { view: "verification", label: "Verification Results", icon: BadgeCheck },
  { view: "audit", label: "Audit Logs", icon: ScrollText },
  { view: "settings", label: "Platform Settings", icon: Settings },
];

export function CommandMenu() {
  const open = useAppStore((s) => s.commandOpen);
  const setOpen = useAppStore((s) => s.setCommandOpen);
  const navigate = useAppStore((s) => s.navigate);
  const recent = useAppStore((s) => s.recent);
  const user = useAppStore((s) => s.user);
  const [tenders, setTenders] = useState<Tender[]>([]);

  /* Role filter — pages (and tender results) outside the role's
     permission set never appear in the palette. */
  const allowed = new Set<View>(user ? ROLE_VIEWS[user.role] : []);
  const pages = ALL_PAGES.filter((p) => allowed.has(p.view));
  const isOfficer = user?.role === "OFFICER";

  useEffect(() => {
    if (!open || tenders.length > 0 || !isOfficer) return;
    api
      .getTenders()
      .then((r) => setTenders(r.tenders))
      .catch(() => setTenders([]));
  }, [open, tenders.length, isOfficer]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      className="top-[12%] translate-y-0 sm:top-[12%]"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search tenders or jump to a page…" />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {pages.length > 0 && (
          <CommandGroup heading="Pages">
            {pages.map(({ view, label, icon: Icon }) => (
              <CommandItem
                key={view}
                value={`page ${label}`}
                onSelect={() => go(() => navigate(view))}
              >
                <Icon className="text-muted-foreground" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isOfficer && recent.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recently viewed">
              {recent.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`recent ${t.code} ${t.title}`}
                  onSelect={() =>
                    go(() =>
                      navigate("tender", { tenderId: t.id, tenderLabel: t.code })
                    )
                  }
                >
                  <Clock3 className="text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                  <span className="truncate">{t.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {isOfficer && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tenders">
              {tenders.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.code} ${t.title} ${t.department}`}
                  onSelect={() =>
                    go(() =>
                      navigate("tender", { tenderId: t.id, tenderLabel: t.code })
                    )
                  }
                >
                  <FileText className="text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                  <span className="truncate">{t.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
