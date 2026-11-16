"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { recordDeploy } from "@/app/actions/sites";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * No-code way to mark a release: describe what changed, and the page is tested
 * straight away so its before/after shows up in the Deploys list.
 */
export function RecordDeployButton({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    start(async () => {
      try {
        const r = await recordDeploy(siteId, label);
        if (!r.ok) return setError(r.error);
        const m = r.outcomes.find((o) => o.strategy === "mobile")?.score;
        toast.success(`Deploy recorded. Mobile score right after it: ${m ?? "run failed"}`);
        setOpen(false);
        setLabel("");
        router.refresh();
      } finally {
        clearInterval(timer);
        setElapsed(0);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-raised px-3 text-xs font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
        <Rocket className="size-3.5" aria-hidden /> Record a deploy
      </DialogTrigger>
      <DialogContent className="border-border-strong bg-popover sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a deploy</DialogTitle>
          <DialogDescription>
            Just released a change? Note it here and we&apos;ll test the page right now. Over the next days you&apos;ll see whether it made the page faster or
            slower, compared with the runs before it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="mt-2">
          <label htmlFor="deploy-label" className="text-sm font-medium text-foreground">
            What changed?
          </label>
          <input
            id="deploy-label"
            autoFocus
            maxLength={120}
            placeholder="e.g. New homepage banner, removed chat widget"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "deploy-label-error" : undefined}
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive"
          />
          {error && (
            <p id="deploy-label-error" className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-white disabled:opacity-80"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? `Testing the page… ${elapsed}s` : "Record and test now"}
          </button>
          <p className="mt-3 text-center text-xs text-subtle">Releasing often? Settings → Deploys can record them automatically from GitHub.</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
