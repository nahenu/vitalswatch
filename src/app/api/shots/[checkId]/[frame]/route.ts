import { eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/db";
import { getSession } from "@/lib/auth";

/**
 * Screenshot of a run: "final" or a filmstrip frame index. Visible to the
 * site's owner, or to anyone when the report is public. A run's screenshots
 * never change, so they're cached hard.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/shots/[checkId]/[frame]">) {
  const { checkId, frame } = await params;
  const id = Number(checkId);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  await dbReady();
  const [row] = await db
    .select({ data: schema.checkDetails.data, userId: schema.sites.userId, isPublic: schema.sites.isPublic })
    .from(schema.checkDetails)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.checkDetails.siteId))
    .where(eq(schema.checkDetails.checkId, id));
  if (!row) return new Response("Not found", { status: 404 });

  if (!row.isPublic) {
    const session = await getSession();
    if (session?.user.id !== row.userId) return new Response("Not found", { status: 404 });
  }

  const dataUrl = frame === "final" ? row.data.finalScreenshot : row.data.filmstrip[Number(frame)]?.img;
  const match = dataUrl?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": row.isPublic ? "public, max-age=31536000, immutable" : "private, max-age=31536000, immutable",
    },
  });
}
