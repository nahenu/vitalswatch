/** Only follow same-site paths after sign-in, never an attacker-supplied URL (open redirect). */
export function safeNext(next: string | undefined | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}
