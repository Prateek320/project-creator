import Link from "next/link";
import { getDb } from "@/db";
import { logout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { NavLinks, type NavItem } from "@/components/nav";
import { Avatar, TestModeBadge } from "@/components/ui";
import { listNotifications } from "@/server/admin";
import { requireActor } from "@/server/session";
import { eq } from "drizzle-orm";
import { schema } from "@/db";

const NAV: Record<string, NavItem[]> = {
  brand: [
    { href: "/brand", label: "Overview", icon: "home", exact: true },
    { href: "/brand/campaigns", label: "Campaigns", icon: "megaphone" },
    { href: "/brand/creators", label: "Discover creators", icon: "search" },
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
    { href: "/admin", label: "Trust & safety queue", icon: "shield", exact: true },
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
      <div className="px-3 pb-4 pt-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Workspace</div>
        <div className="mt-0.5 truncate text-sm font-medium text-ink">{workspace}</div>
      </div>
      <nav aria-label="Primary">
        <NavLinks items={items} />
      </nav>
    </>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-line bg-white lg:flex lg:min-h-dvh lg:flex-col lg:px-3 lg:py-5">
        <Link href="/" className="mb-6 px-3">
          <Logo />
        </Link>
        {sidebar}
        <div className="mt-auto rounded-xl border border-line bg-slate-50 p-3 text-xs text-muted">
          Demo build. Payments and social data run in mock mode with seeded test data.
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <details className="relative lg:hidden">
            <summary aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-lg border border-line">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </summary>
            <div className="absolute left-0 top-11 w-64 rounded-xl border border-line bg-white p-2 shadow-lg">{sidebar}</div>
          </details>
          <Link href="/" className="lg:hidden"><Logo className="text-sm" /></Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline-flex"><TestModeBadge /></span>
            <Link href="/notifications" className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-slate-100" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {unread > 0 && <span className="tnum absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <details className="relative">
              <summary className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100">
                <Avatar name={actor.name} size={30} />
                <span className="hidden text-sm font-medium sm:inline">{actor.name}</span>
              </summary>
              <div className="absolute right-0 top-11 w-56 rounded-xl border border-line bg-white p-2 text-sm shadow-lg">
                <div className="px-2 py-1.5 text-muted">{actor.email}</div>
                {actor.role === "creator" && actor.creatorProfileId && <Link className="block rounded-lg px-2 py-1.5 hover:bg-slate-100" href={`/creators/${actor.creatorProfileId}`}>View public profile</Link>}
                <Link className="block rounded-lg px-2 py-1.5 hover:bg-slate-100" href="/login">Switch demo account</Link>
                <form action={logout}><button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-100">Sign out</button></form>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
