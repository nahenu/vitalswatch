import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <AuthShell title="Create your account" subtitle="Watch your first page in under a minute.">
      <AuthForm mode="sign-up" />
      <Suspense>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
