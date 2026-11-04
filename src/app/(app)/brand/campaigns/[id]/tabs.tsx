"use client";
import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

export function CampaignTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/brand/campaigns/${id}`;
  return (
    <Tabs
      active={path}
      tabs={[
        { href: base, label: "Overview" },
        { href: `${base}/applications`, label: "Applications & creators" },
        { href: `${base}/analytics`, label: "Results & attribution" },
      ]}
    />
  );
}
