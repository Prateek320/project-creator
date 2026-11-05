"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Handshake,
  Inbox,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletMinimal,
  House,
} from "lucide-react";
import { cx } from "./ui";

const ICONS = {
  home: House,
  dashboard: LayoutDashboard,
  megaphone: Megaphone,
  users: UsersRound,
  search: Compass,
  wallet: WalletMinimal,
  settings: Settings,
  inbox: Inbox,
  handshake: Handshake,
  user: UserRound,
  shield: ShieldCheck,
  list: ScrollText,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
}

/** Selected state uses colour and a raised surface only — never size or weight — so nothing shifts. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((it) => {
        const active = it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
        const Icon = ICONS[it.icon];
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-all duration-150",
                active
                  ? "bg-ink text-white shadow-[0_6px_16px_-8px_rgba(15,18,34,0.6)]"
                  : "text-ink-2 hover:bg-white/70 hover:text-ink",
              )}
            >
              <Icon size={18} strokeWidth={1.9} className={cx("transition-colors", active ? "text-lime" : "text-faint group-hover:text-ink-2")} aria-hidden />
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
