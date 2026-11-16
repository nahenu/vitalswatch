"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { createSite } from "@/app/actions/sites";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function AddSiteDialog({ variant = "primary" }: { variant?: "primary" | "hero" | "icon" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSite(url);
      if (!result.ok) return setError(result.error);
      // The sidebar's copy of this dialog outlives navigation, so close and reset it explicitly.
      setOpen(false);
      setUrl("");
      router.push(`/sites/${result.id}?first=1`);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      {variant === "icon" ? (
        <DialogTrigger className="grid size-6 place-items-center rounded-md text-subtle outline-none hover:bg-white/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <Plus className="size-3.5" aria-hidden />
          <span className="sr-only">Add a page</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-primary font-medium text-primary-foreground outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            variant === "hero" ? "h-11 px-5 text-sm" : "h-9 px-3.5 text-sm",
          )}
        >
          <Plus className="size-4" aria-hidden /> Add a page
        </DialogTrigger>
      )}
      <DialogContent className="border-border-strong bg-popover sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Watch a page</DialogTitle>
          <DialogDescription>
            We&apos;ll test it on mobile and desktop right away, then every day. Use your most important page: home, pricing or a landing page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="mt-2">
          <label htmlFor="site-url" className="text-sm font-medium text-foreground">
            Page address
          </label>
          <input
            id="site-url"
            autoFocus
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "site-url-error" : undefined}
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive"
          />
          {error && (
            <p id="site-url-error" className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-white disabled:opacity-70"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? "Adding…" : "Start watching"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
