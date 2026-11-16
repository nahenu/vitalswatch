import { createAuthClient } from "better-auth/react";

/** Browser-side auth API (sign in, sign up, sign out). Talks to /api/auth on the same origin. */
export const authClient = createAuthClient();
