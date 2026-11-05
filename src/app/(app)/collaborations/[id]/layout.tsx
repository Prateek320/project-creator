import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { Avatar, PageHeader, StatusChip } from "@/components/ui";
import { getCollaboration } from "@/server/collaborations";
import { requireActor } from "@/server/session";
import { CollabTabs } from "./tabs";
import { eq } from "drizzle-orm";
import { schema } from "@/db";

export default async function CollabLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const db = await getDb();
  const c = await getCollaboration(db, actor, id).catch(() => null);
  if (!c) notFound();
  const [brand] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, c.campaign.organizationId));
  const status = c.active?.status ?? c.pending?.status ?? c.root.status;
  const back = c.side === "creator" ? { href: "/creator/collaborations", label: "Collaborations" } : c.side === "brand" ? { href: `/brand/campaigns/${c.campaign.id}`, label: c.campaign.title } : { href: "/admin/queue", label: "Queue" };
  return (
    <>
      <PageHeader
        eyebrow={<Link href={back.href} className="hover:text-ink">← {back.label}</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{c.campaign.title}<StatusChip status={status} /></span>}
        description={<span className="inline-flex flex-wrap items-center gap-2"><Avatar name={c.creator.displayName} color={c.creator.accent} size={20} /><Link href={`/creators/${c.creator.id}`} className="hover:text-ink">{c.creator.displayName}</Link> × {brand?.displayName}</span>}
      />
      <CollabTabs id={c.root.id} />
      {children}
    </>
  );
}
