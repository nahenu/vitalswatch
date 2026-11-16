import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

/**
 * Renders nothing; sends already-signed-in visitors on to the app. Kept separate
 * from the form so the form itself is never swapped out mid-typing.
 */
export async function RedirectIfSignedIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next } = await searchParams;
  if (await getSession()) redirect(safeNext(typeof next === "string" ? next : undefined));
  return null;
}
