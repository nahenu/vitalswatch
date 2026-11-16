"use server";

import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db, dbReady, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { runChecks, type RunOutcome } from "@/lib/checks";
import { newPublicId } from "@/lib/id";
import { getOwnedSite } from "@/lib/sites";
import { normalizeSiteUrl } from "@/lib/url";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_SITES = 10;
/** A full mobile + desktop run costs Google ~1 minute of compute; don't let a double-click queue another. */
const MIN_GAP_MS = 60_000;

const siteId = z.string().min(1).max(64);

async function userIdOrNull() {
  await dbReady();
  const session = await getSession();
  return session?.user.id ?? null;
}

export async function createSite(input: unknown): Promise<Result<{ id: string }>> {
  const userId = await userIdOrNull();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
  const parsed = normalizeSiteUrl(typeof input === "string" ? input : "");
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const existing = await db.select({ id: schema.sites.id, url: schema.sites.url }).from(schema.sites).where(eq(schema.sites.userId, userId));
  const duplicate = existing.find((s) => s.url === parsed.url);
  if (duplicate) return { ok: false, error: "You're already watching this page." };
  if (existing.length >= MAX_SITES) return { ok: false, error: `You can watch up to ${MAX_SITES} pages for now.` };

  const id = newPublicId();
  await db.insert(schema.sites).values({ id, userId, name: parsed.name, url: parsed.url, deployToken: `vw_${newPublicId(32)}` });
  return { ok: true, id };
}

export async function runCheckNow(id: unknown): Promise<Result<{ outcomes: RunOutcome[] }>> {
  const userId = await userIdOrNull();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
  const parsedId = siteId.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Site not found." };
  const site = await getOwnedSite(userId, parsedId.data);
  if (!site) return { ok: false, error: "Site not found." };

  const [recent] = await db
    .select({ id: schema.checks.id })
    .from(schema.checks)
    .where(and(eq(schema.checks.siteId, site.id), gte(schema.checks.createdAt, new Date(Date.now() - MIN_GAP_MS))))
    .orderBy(desc(schema.checks.createdAt))
    .limit(1);
  if (recent) return { ok: false, error: "This page was just tested. Wait a minute before running it again." };

  const outcomes = await runChecks(site, "manual");
  return { ok: true, outcomes };
}

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Give the site a name.").max(60),
  alertDrop: z.number().int().min(0).max(50),
  isPublic: z.boolean(),
});

export async function updateSite(id: unknown, input: unknown): Promise<Result> {
  const userId = await userIdOrNull();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
  const parsedId = siteId.safeParse(id);
  const parsed = settingsSchema.safeParse(input);
  if (!parsedId.success) return { ok: false, error: "Site not found." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the settings and try again." };

  const [row] = await db
    .update(schema.sites)
    .set(parsed.data)
    .where(and(eq(schema.sites.id, parsedId.data), eq(schema.sites.userId, userId)))
    .returning({ id: schema.sites.id });
  if (!row) return { ok: false, error: "Site not found." };
  return { ok: true };
}

export async function rotateDeployToken(id: unknown): Promise<Result<{ token: string }>> {
  const userId = await userIdOrNull();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
  const parsedId = siteId.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Site not found." };
  const token = `vw_${newPublicId(32)}`;
  const [row] = await db
    .update(schema.sites)
    .set({ deployToken: token })
    .where(and(eq(schema.sites.id, parsedId.data), eq(schema.sites.userId, userId)))
    .returning({ id: schema.sites.id });
  return row ? { ok: true, token } : { ok: false, error: "Site not found." };
}

const deployLabel = z.string().trim().min(1, "Describe what changed, e.g. \"New homepage banner\".").max(120);

/**
 * "Record a deploy" without any CI setup: saves a deploy marker with the
 * person's own description, then tests the page right away so the before/after
 * comparison has its first "after" run.
 */
export async function recordDeploy(id: unknown, label: unknown): Promise<Result<{ outcomes: RunOutcome[] }>> {
  const userId = await userIdOrNull();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
  const parsedId = siteId.safeParse(id);
  const parsedLabel = deployLabel.safeParse(label);
  if (!parsedId.success) return { ok: false, error: "Site not found." };
  if (!parsedLabel.success) return { ok: false, error: parsedLabel.error.issues[0]?.message ?? "Describe what changed." };
  const site = await getOwnedSite(userId, parsedId.data);
  if (!site) return { ok: false, error: "Site not found." };

  // Manual deploys have no commit SHA: use a short date tag as the reference.
  const ref = new Date().toISOString().slice(5, 16).replace("T", " ");
  await db.insert(schema.deploys).values({ siteId: site.id, ref, message: parsedLabel.data });
  const outcomes = await runChecks(site, "deploy");
  return { ok: true, outcomes };
}

/** Turn the read-only public report on or off (the Share button). */
export async function setPublic(id: unknown, value: unknown): Promise<Result> {
  const userId = await userIdOrNull();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
  const parsedId = siteId.safeParse(id);
  if (!parsedId.success || typeof value !== "boolean") return { ok: false, error: "Site not found." };
  const [row] = await db
    .update(schema.sites)
    .set({ isPublic: value })
    .where(and(eq(schema.sites.id, parsedId.data), eq(schema.sites.userId, userId)))
    .returning({ id: schema.sites.id });
  return row ? { ok: true } : { ok: false, error: "Site not found." };
}

export async function deleteSite(id: unknown): Promise<Result> {
  const userId = await userIdOrNull();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
  const parsedId = siteId.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Site not found." };
  const [row] = await db
    .delete(schema.sites)
    .where(and(eq(schema.sites.id, parsedId.data), eq(schema.sites.userId, userId)))
    .returning({ id: schema.sites.id });
  return row ? { ok: true } : { ok: false, error: "Site not found." };
}
