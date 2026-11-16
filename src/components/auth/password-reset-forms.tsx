"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, emailError, newPasswordError } from "@/lib/auth-errors";
import { useHydrated } from "@/lib/use-hydrated";
import { useSearchParam } from "@/lib/use-search-param";
import { FormAlert, PasswordField, TextField } from "./fields";

const submitClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-white disabled:opacity-70";

export function ForgotPasswordForm() {
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const problem = emailError(email);
    setError(problem);
    if (problem) return;

    setPending(true);
    setServerError(null);
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (error) {
      setServerError(authErrorMessage(error));
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <div className="space-y-5">
        <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <MailCheck className="size-6" aria-hidden />
        </span>
        {/* Same message whether or not the account exists, so this page can't be used to find out who has one. */}
        <p role="status" className="text-foreground">
          If an account exists for <strong>{sentTo}</strong>, we&apos;ve sent a link to reset its password. It works for one hour.
        </p>
        {process.env.NODE_ENV !== "production" && (
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            Development: no email provider is set, so the link is printed in the server console.
          </p>
        )}
        <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} method="post" noValidate className="space-y-4">
      <TextField
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (submitted) setError(emailError(e.target.value));
        }}
        error={error}
      />
      {serverError && <FormAlert tone="error">{serverError}</FormAlert>}
      <button type="submit" disabled={pending || !hydrated} className={submitClass}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Send reset link
      </button>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const token = useSearchParam("token");
  const linkError = useSearchParam("error");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const passwordProblem = submitted ? newPasswordError(password) : null;
  const confirmProblem = submitted && !passwordProblem && confirm !== password ? "The two passwords don't match." : null;

  if (hydrated && (linkError || !token)) {
    return (
      <div className="space-y-5">
        <FormAlert tone="error">This reset link has expired or was already used. Links work once, for one hour.</FormAlert>
        <Link href="/forgot-password" className={submitClass}>
          Send a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (newPasswordError(password) || confirm !== password || !token) return;

    setPending(true);
    setServerError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setPending(false);
      setServerError(authErrorMessage(error));
      return;
    }
    router.push("/sign-in?reset=1");
  }

  return (
    <form onSubmit={onSubmit} method="post" noValidate className="space-y-4">
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={passwordProblem}
        showStrength
        hint="At least 8 characters."
      />
      <PasswordField
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={confirmProblem}
      />
      {serverError && (
        <FormAlert tone="error">
          {serverError}{" "}
          <Link href="/forgot-password" className="underline underline-offset-2">
            Get a new link
          </Link>
        </FormAlert>
      )}
      <button type="submit" disabled={pending || !hydrated} className={submitClass}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Update password
      </button>
      <p className="text-center text-xs text-muted-foreground">You&apos;ll be signed out on your other devices.</p>
    </form>
  );
}
