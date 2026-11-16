"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setPublic } from "@/app/actions/sites";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ghost =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-raised px-3 text-sm font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring";

/** A real PDF file, generated on the server. */
export function DownloadPdfButton({ siteId, strategy = "mobile", compact = false }: { siteId: string; strategy?: string; compact?: boolean }) {
  return (
    <a href={`/api/reports/${siteId}/pdf?strategy=${strategy}`} download className={compact ? "inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.04] hover:text-foreground" : ghost}>
      <Download className={compact ? "size-3.5" : "size-4"} aria-hidden /> {compact ? `PDF (${strategy})` : "Download PDF"}
    </a>
  );
}

/**
 * Copies the read-only report link. A private report asks first, because
 * sharing makes the report visible to anyone with the link.
 */
export function ShareButton({ siteId, isPublic, appUrl }: { siteId: string; isPublic: boolean; appUrl: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const link = `${appUrl}/r/${siteId}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Report link copied");
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <button type="button" className={ghost} onClick={() => (isPublic ? copy() : setConfirm(true))}>
        {copied ? <Check className="size-4 text-good" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {copied ? "Copied" : "Share"}
      </button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="border-border-strong bg-popover sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share a read-only report?</DialogTitle>
            <DialogDescription>
              Anyone with the link can see scores, trends and diagnostics for this page. Settings and the deploy token stay private. You can turn it off any
              time in Settings.
            </DialogDescription>
          </DialogHeader>
          <p className="mt-1 truncate rounded-lg border border-border bg-screen px-3 py-2 font-mono text-xs text-muted-foreground">{link}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await setPublic(siteId, true);
                  if (!r.ok) return void toast.error(r.error);
                  await copy();
                  setConfirm(false);
                  router.refresh();
                })
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-white disabled:opacity-70"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Make public and copy link
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
