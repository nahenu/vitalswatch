import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db, dbReady, schema } from "@/db";
import { runChecks } from "@/lib/checks";

export const maxDuration = 120;

const body = z.object({
  ref: z.string().trim().min(1).max(80),
  message: z.string().trim().max(200).optional(),
});

/**
 * Deploy webhook. Call it from CI after each deploy:
 *
 *   curl -X POST https://<app>/api/deploys \
 *     -H "Authorization: Bearer $VITALSWATCH_TOKEN" \
 *     -d '{"ref":"'"$GITHUB_SHA"'"}'
 *
 * Records the deploy, answers right away, then tests the site in the
 * background so the before/after comparison fills in a minute later.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return Response.json({ error: "Missing Authorization: Bearer <deploy token>" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: 'Send a JSON body like {"ref":"a1b2c3d"}' }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return Response.json({ error: '"ref" is required: a commit SHA, tag or short label.' }, { status: 400 });

  await dbReady();
  const [site] = await db.select().from(schema.sites).where(eq(schema.sites.deployToken, token));
  if (!site) return Response.json({ error: "Unknown deploy token." }, { status: 401 });

  const [deploy] = await db
    .insert(schema.deploys)
    .values({ siteId: site.id, ref: parsed.data.ref, message: parsed.data.message })
    .returning({ id: schema.deploys.id, createdAt: schema.deploys.createdAt });

  after(() => runChecks(site, "deploy").catch((e) => console.error("[deploys]", e)));

  return Response.json({ ok: true, deploy: deploy.id, site: site.id, checking: true }, { status: 202 });
}
