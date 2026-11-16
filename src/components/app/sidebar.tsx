"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, ExternalLink, LayoutGrid, LogOut } from "lucide-react";
import { LogoMark } from "@/components/marketing/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RATING_BG } from "@/components/ui/rating";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { rateScore } from "@/lib/vitals";
import { AddSiteDialog } from "./add-site-dialog";
import { NextRunCountdown } from "./next-run";

export interface SidebarSite {
  id: string;
  name: string;
  mobile: number | null;
  failing: boolean;
}

interface User {
  name: string;
  email: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

function AccountMenu({ user, compact = false }: { user: User; compact?: boolean }) {
  const router = useRouter();
  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "p-0.5" : "w-full p-2 hover:bg-white/[0.04]",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#2dd4e6,#0e7490)] text-[11px] font-semibold text-primary-foreground">
          {initials(user.name)}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{user.name}</span>
              <span className="block truncate text-[11px] text-subtle">{user.email}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" aria-hidden />
          </>
        )}
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/">
            <ExternalLink /> VitalsWatch website
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Left rail of the console: every watched page with its live status, always one click away. */
export function Sidebar({ user, sites }: { user: User; sites: SidebarSite[] }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <LogoMark className="size-6" />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">VitalsWatch</span>
      </div>

      <nav className="px-3" aria-label="Console">
        <Link
          href="/dashboard"
          aria-current={pathname === "/dashboard" ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
            pathname === "/dashboard" && "bg-white/[0.06] text-foreground",
          )}
        >
          <LayoutGrid className="size-4" aria-hidden /> Overview
        </Link>
      </nav>

      <div className="mt-6 flex items-center justify-between px-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">Sites · {sites.length}</p>
        <AddSiteDialog variant="icon" />
      </div>
      <ul className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {sites.map((s) => {
          const active = pathname === `/sites/${s.id}`;
          const dot = s.failing && s.mobile == null ? "bg-poor" : s.mobile == null ? "bg-subtle" : RATING_BG[rateScore(s.mobile)];
          return (
            <li key={s.id}>
              <Link
                href={`/sites/${s.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  active && "bg-white/[0.06] text-foreground",
                )}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="text-xs tabular-nums text-subtle">{s.mobile ?? "—"}</span>
              </Link>
            </li>
          );
        })}
        {!sites.length && <li className="px-2.5 py-2 text-xs text-subtle">No pages yet.</li>}
      </ul>

      <div className="border-t border-border p-3">
        <div className="mb-2 rounded-lg border border-border bg-screen px-3 py-2.5">
          <p className="flex items-center gap-2 text-[11px] text-subtle">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
            </span>
            Next daily run
          </p>
          <NextRunCountdown className="mt-1 block text-lg font-medium tabular-nums tracking-tight text-foreground" />
        </div>
        <AccountMenu user={user} />
      </div>
    </aside>
  );
}

/** Below the lg breakpoint the rail collapses into a slim top bar. */
export function MobileBar({ user }: { user?: User }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <LogoMark className="size-6" /> VitalsWatch
      </Link>
      {user ? <AccountMenu user={user} compact /> : <span className="size-8 rounded-full bg-muted" aria-hidden />}
    </header>
  );
}
