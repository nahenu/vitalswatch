import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, dbReady, schema } from "@/db";
import { resetPasswordEmail, sendEmail } from "@/lib/email";

// On Vercel, fall back to the project's own domains, so a missing or stale
// BETTER_AUTH_URL can't lock everyone out with "Invalid origin".
const https = (host?: string) => (host ? `https://${host}` : undefined);
const vercelOrigins = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]
  .map(https)
  .filter((o): o is string => !!o);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || https(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  trustedOrigins: vercelOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    // A password reset signs out every other device.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...resetPasswordEmail(user.name, url) });
    },
  },
  session: {
    // "Remember me" keeps people signed in for 7 days, extended once a day while
    // they keep using it. Unticked, the session ends when the browser closes.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Avoid a database round trip on every request; sessions are re-checked every 5 minutes.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    // On by default in production (brute-force protection on sign-in and sign-up).
    // The end-to-end suite signs up many accounts from one IP at once, so its test
    // server sets AUTH_RATE_LIMIT=off. Never set that in a real deployment.
    enabled: process.env.AUTH_RATE_LIMIT === "off" ? false : undefined,
  },
  plugins: [nextCookies()],
});

export async function getSession() {
  // Read the request first: it marks the page as dynamic, so prerendering stops here and never touches the database.
  const requestHeaders = await headers();
  await dbReady();
  return auth.api.getSession({ headers: requestHeaders });
}

/** The signed-in user, or a redirect to sign in (preserving where they were going). */
export async function requireUser(returnTo?: string) {
  const session = await getSession();
  if (!session) redirect(returnTo ? `/sign-in?next=${encodeURIComponent(returnTo)}` : "/sign-in");
  return session.user;
}
