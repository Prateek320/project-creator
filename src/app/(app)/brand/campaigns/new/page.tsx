import { Flash, PageHeader } from "@/components/ui";
import { requireActor } from "@/server/session";
import { CampaignBuilder } from "./builder";
import Link from "next/link";

export const metadata = { title: "New campaign" };

export default async function NewCampaign({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireActor("brand");
  const sp = await searchParams;
  return (
    <>
      <PageHeader eyebrow={<Link href="/brand/campaigns" className="hover:text-ink">← Campaigns</Link>} title="New campaign" description="Four short steps. Advanced settings stay tucked away until you need them." />
      <Flash sp={sp} />
      <CampaignBuilder />
    </>
  );
}
