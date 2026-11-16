"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  /** Extra content on the label row, e.g. a "Forgot password?" link. */
  aside?: ReactNode;
}

function FieldShell({
  id,
  label,
  error,
  hint,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function TextField({ label, error, hint, aside, className, ...props }: FieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} aside={aside}>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn("h-11 rounded-lg", className)}
        {...props}
      />
    </FieldShell>
  );
}

/** 0–4 from length and character variety. A nudge, not a policy: the server only enforces length. */
export function passwordScore(password: string): number {
  if (password.length < 8) return password.length ? 1 : 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  return Math.min(4, 1 + (password.length >= 12 ? 1 : 0) + (variety >= 3 ? 1 : 0) + (variety === 4 || password.length >= 16 ? 1 : 0));
}

const STRENGTH = ["", "Too short", "Okay", "Good", "Strong"];

export function PasswordField({
  label,
  error,
  hint,
  aside,
  showStrength = false,
  value,
  onChange,
  onBlur,
  ...props
}: FieldProps & { showStrength?: boolean; value: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const score = passwordScore(value);

  const strengthHint = showStrength && value ? (
    <span className="flex items-center gap-2">
      <span className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={cn("h-1 w-6 rounded-full", n <= score ? (score <= 1 ? "bg-destructive" : score === 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-secondary")}
          />
        ))}
      </span>
      <span>{STRENGTH[score]}</span>
    </span>
  ) : (
    hint
  );

  return (
    <FieldShell id={id} label={label} error={error} hint={capsLock ? <span className="font-medium text-amber-700">Caps Lock is on</span> : strengthHint} aside={aside}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          className="h-11 rounded-lg pr-11"
          value={value}
          onChange={onChange}
          onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
          onBlur={(e) => {
            setCapsLock(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </FieldShell>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
        tone === "error" ? "bg-destructive/10 text-destructive" : "bg-good/10 text-good",
      )}
    >
      {tone === "error" ? <AlertCircle className="mt-px size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}
