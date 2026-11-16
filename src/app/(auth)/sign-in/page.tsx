import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see how your pages are doing.">
      <AuthForm mode="sign-in" />
      <Suspense>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
