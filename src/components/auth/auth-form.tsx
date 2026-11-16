"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, emailError, newPasswordError } from "@/lib/auth-errors";
import { safeNext } from "@/lib/safe-next";
import { useHydrated } from "@/lib/use-hydrated";
import { useSearchParam } from "@/lib/use-search-param";
import { FormAlert, PasswordField, TextField } from "./fields";

/** `?next=` read at click time rather than via a hook, so the form can render statically. */
function currentNext() {
  return new URLSearchParams(window.location.search).get("next");
}

type Errors = Partial<Record<"name" | "email" | "password", string>>;

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const isSignUp = mode === "sign-up";
  const otherPage = isSignUp ? "/sign-in" : "/sign-up";
  const justReset = useSearchParam("reset") === "1";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; existingAccount?: boolean } | null>(null);

  function validate(): Errors {
    const next: Errors = {};
    if (isSignUp && !name.trim()) next.name = "Enter your name.";
    const e = emailError(email);
    if (e) next.email = e;
    if (isSignUp) {
      const p = newPasswordError(password);
      if (p) next.password = p;
    } else if (!password) {
      next.password = "Enter your password.";
    }
    return next;
  }

  // Errors appear after the first submit, then update live as the person fixes them.
  const shown: Errors = submitted ? validate() : {};

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validate()).length) {
      // Focus the first problem once React has rendered the error state.
      const form = e.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }

    setPending(true);
    setServerError(null);
    const { error } = isSignUp
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
      : await authClient.signIn.email({ email: email.trim(), password, rememberMe });

    if (error) {
      setPending(false);
      setServerError({
        message: authErrorMessage(error),
        existingAccount: error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      });
      return;
    }
    router.push(safeNext(currentNext()));
    router.refresh();
  }

  return (
    // method="post": if someone submits before JavaScript loads, credentials must never land in the URL.
    // noValidate: our own messages replace the browser's popups.
    <form onSubmit={onSubmit} method="post" noValidate className="space-y-4">
      {justReset && !isSignUp && <FormAlert tone="success">Password updated. Sign in with your new password.</FormAlert>}

      {isSignUp && (
        <TextField label="Your name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={shown.name} />
      )}
      <TextField
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={shown.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={shown.password}
        showStrength={isSignUp}
        hint={isSignUp ? "At least 8 characters." : undefined}
        aside={
          !isSignUp && (
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          )
        }
      />

      {!isSignUp && (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="size-4 cursor-pointer rounded border-input accent-primary"
          />
          Remember me for 7 days
        </label>
      )}

      {serverError && (
        <FormAlert tone="error">
          {serverError.message}{" "}
          {serverError.existingAccount && (
            <Link href="/sign-in" className="underline underline-offset-2">
              Sign in instead
            </Link>
          )}
        </FormAlert>
      )}

      <button
        type="submit"
        disabled={pending || !hydrated}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-white disabled:opacity-70"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {isSignUp ? "Create account" : "Sign in"}
      </button>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "New to VitalsWatch? "}
        <Link
          href={otherPage}
          onClick={(e) => {
            // Carry ?next= across so the visitor still lands where they were headed.
            const next = currentNext();
            if (next) {
              e.preventDefault();
              router.push(`${otherPage}?next=${encodeURIComponent(next)}`);
            }
          }}
          className="font-semibold text-primary hover:underline"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
