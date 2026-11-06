import { getDb } from "@/db";
import { DomainError } from "@/domain/types";
import { getExport } from "@/server/privacy";
import { getActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** Downloads the signed-in person's own data export. Anything else is a 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return new Response("Not found", { status: 404 });
  try {
    const bundle = await getExport(await getDb(), actor, (await params).id);
    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="proovd-data-export.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DomainError) return new Response("Not found", { status: 404 });
    throw err;
  }
}
