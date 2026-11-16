import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = {
  title: "Choose a new password",
  // The URL carries a one-time token: never let it be indexed or cached by a referrer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
