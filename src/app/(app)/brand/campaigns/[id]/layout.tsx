import Link from "next/link";
import { getDb } from "@/db";
import { PageHeader, StatusChip } from "@/components/ui";
import { getOwnedCampaign } from "@/server/core";
import { requireActor } from "@/server/session";
import { notFound } from "next/navigation";
import { CampaignTabs } from "./tabs";

export default async function CampaignLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const actor = await requireActor("brand");
  const { id } = await params;
  const c = await getOwnedCampaign(await getDb(), actor, id).catch(() => null);
  if (!c) notFound();
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/brand/campaigns" className="hover:text-ink">← Campaigns</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{c.title} <StatusChip status={c.status} /></span>}
      />
      <CampaignTabs id={c.id} />
      {children}
    </>
  );
}

