import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/ui";

export function OnboardingShell({ title, lead, sp, children }: { title: string; lead: ReactNode; sp: Record<string, string | undefined>; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <main id="main" className="page-enter mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <Link href="/" aria-label="proovd home"><Logo /></Link>
        <h1 className="mt-10 text-[28px] font-bold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 text-muted">{lead}</p>
        <div className="mt-8"><Flash sp={sp} /></div>
        {children}
      </main>
    </div>
  );
}
