import Link from "next/link";
import { getDb } from "@/db";
import { logout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { NavLinks, type NavItem } from "@/components/nav";
import { Avatar, TestModeBadge } from "@/components/ui";
import { ArrowLeftRight, Bell, ChevronDown, FlaskConical, LogOut, Menu, UserRound } from "lucide-react";
import { listNotifications } from "@/server/admin";
import { requireActor } from "@/server/session";
import { eq } from "drizzle-orm";
import { schema } from "@/db";

const NAV: Record<string, NavItem[]> = {
  brand: [
    { href: "/brand", label: "Overview", icon: "dashboard", exact: true },
    { href: "/brand/campaigns", label: "Campaigns", icon: "megaphone" },
    { href: "/brand/creators", label: "Discover creators", icon: "users" },
    { href: "/brand/billing", label: "Billing & ledger", icon: "wallet" },
    { href: "/brand/settings", label: "Team & settings", icon: "settings" },
  ],
  creator: [
    { href: "/creator", label: "Home", icon: "home", exact: true },
    { href: "/creator/campaigns", label: "Discover campaigns", icon: "search" },
    { href: "/creator/applications", label: "Applications", icon: "inbox" },
    { href: "/creator/collaborations", label: "Collaborations", icon: "handshake" },
    { href: "/creator/earnings", label: "Earnings", icon: "wallet" },
    { href: "/creator/profile", label: "Profile & portfolio", icon: "user" },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: "dashboard", exact: true },
    { href: "/admin/queue", label: "Trust & safety queue", icon: "shield" },
    { href: "/admin/audit", label: "Audit trail", icon: "list" },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const db = await getDb();
  const { unread } = await listNotifications(db, actor);
  const [org] = actor.orgId ? await db.select().from(schema.organizations).where(eq(schema.organizations.id, actor.orgId)) : [];
  const items = NAV[actor.role] ?? [];
  const workspace = actor.role === "brand" ? (org?.displayName ?? "Brand") : actor.role === "creator" ? "Creator workspace" : "Platform operations";

  const sidebar = (
    <>
      <div className="mx-1 mb-5 rounded-2xl border border-white/70 bg-white/60 px-3 py-2.5 shadow-sm">
        <div className="eyebrow">Workspace</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-ink">{workspace}</div>
      </div>
      <nav aria-label="Primary">
        <NavLinks items={items} />
      </nav>
    </>
  );

  return (
    <div data-workspace={actor.role} className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden border-r border-white/60 bg-white/35 backdrop-blur-md lg:block">
        <div className="sticky top-0 flex h-dvh flex-col px-4 py-6">
          <Link href="/" className="mb-7 px-2">
            <Logo />
          </Link>
          {sidebar}
          <div className="mt-auto flex gap-2.5 rounded-2xl border border-white/70 bg-white/55 p-3 text-xs leading-relaxed text-ink-2">
            <FlaskConical size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <span>Demo build. Payments and social data run in mock mode with seeded test data.</span>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/60 bg-white/45 px-4 backdrop-blur-md backdrop-saturate-150 sm:px-8">
          <details className="relative lg:hidden">
            <summary aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-sm">
              <Menu size={18} aria-hidden />
            </summary>
            <div className="absolute left-0 top-11 w-72 rounded-3xl border border-white/70 bg-gradient-to-br from-green-50 via-amber-50 to-blue-50 p-3 shadow-[var(--shadow-pop)]">{sidebar}</div>
          </details>
          <Link href="/" className="lg:hidden"><Logo size={26} /></Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline-flex"><TestModeBadge /></span>
            <Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-sm transition-transform hover:scale-105" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell size={19} strokeWidth={1.9} aria-hidden />
              {unread > 0 && <span className="tnum absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-lime ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <details className="relative">
              <summary className="flex items-center gap-2.5 rounded-full bg-white/70 py-1 pl-1 pr-1 shadow-sm transition-colors hover:bg-white sm:pr-3">
                <Avatar name={actor.name} size={32} />
                <span className="hidden text-sm font-semibold sm:inline">{actor.name}</span>
                <ChevronDown size={15} className="hidden text-faint sm:inline" aria-hidden />
              </summary>
              <div className="absolute right-0 top-12 w-60 rounded-2xl border border-white/70 bg-white/95 p-2 text-sm shadow-[var(--shadow-pop)] backdrop-blur-md">
                <div className="px-3 pb-2 pt-1.5"><div className="font-semibold">{actor.name}</div><div className="truncate text-xs text-muted">{actor.email}</div></div>
                <div className="my-1 h-px bg-line-2" />
                {actor.role === "creator" && actor.creatorProfileId && <Link className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-black/5" href={`/creators/${actor.creatorProfileId}`}><UserRound size={16} className="text-faint" aria-hidden />View public profile</Link>}
                <Link className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-black/5" href="/login"><ArrowLeftRight size={16} className="text-faint" aria-hidden />Switch demo account</Link>
                <form action={logout}><button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-black/5"><LogOut size={16} className="text-faint" aria-hidden />Sign out</button></form>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="page-enter mx-auto max-w-[1240px] px-4 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
