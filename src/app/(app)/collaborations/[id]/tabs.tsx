"use client";
import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

export function CollabTabs({ id }: { id: string }) {
  const path = usePathname();
  return <Tabs active={path.endsWith("/settlement") ? `/collaborations/${id}/settlement` : `/collaborations/${id}`} tabs={[{ href: `/collaborations/${id}`, label: "Workspace" }, { href: `/collaborations/${id}/settlement`, label: "Earnings & settlement" }]} />;
}
