"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronDown, Copy, Loader2, RefreshCw, Rocket, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSite, rotateDeployToken, updateSite } from "@/app/actions/sites";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  site: { id: string; name: string; isPublic: boolean; alertDrop: number; deployToken: string };
  appUrl: string;
  /** Latest mobile score, to explain alert levels with a real example. */
  mobileScore: number | null;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-raised px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {done ? <Check className="size-3.5 text-good" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {done ? "Copied" : label}
    </button>
  );
}

function Snippet({ code, copyLabel, title }: { code: string; copyLabel: string; title?: string }) {
  return (
    <div className="mt-2 rounded-lg border border-border bg-screen">
      {title && <p className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-subtle">{title}</p>}
      <pre className="whitespace-pre-wrap px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{code}</pre>
      <div className="flex justify-end border-t border-border px-2 py-1.5">
        <CopyButton text={code} label={copyLabel} />
      </div>
    </div>
  );
}

/** Alert sensitivity in words people use, stored as the point drop that triggers an email. */
const LEVELS = [
  { value: 0, label: "Off", hint: "No emails." },
  { value: 15, label: "Big drops only", hint: "Only clear regressions." },
  { value: 10, label: "Normal", hint: "Recommended." },
  { value: 5, label: "Sensitive", hint: "May email on smaller wobbles." },
];

type Tab = "general" | "alerts" | "deploys";

export function SiteSettings({ site, appUrl, mobileScore }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("general");
  const [name, setName] = useState(site.name);
  const [alertDrop, setAlertDrop] = useState(site.alertDrop);
  const [isPublic, setIsPublic] = useState(site.isPublic);
  const [token, setToken] = useState(site.deployToken);
  const [showCurl, setShowCurl] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const endpoint = `${appUrl}/api/deploys`;
  const workflow = `name: VitalsWatch
on: deployment_status   # fires when Vercel, Netlify etc. finish a deploy

jobs:
  record-deploy:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST ${endpoint} \\
            -H "Authorization: Bearer \${{ secrets.VITALSWATCH_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            -d '{"ref":"\${{ github.sha }}","message":"Deploy to \${{ github.event.deployment.environment }}"}'`;
  const curl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"ref":"v1.4.2","message":"New homepage banner"}'`;

  const level = LEVELS.find((l) => l.value === alertDrop) ?? LEVELS[2];
  const example =
    alertDrop === 0
      ? "You won't get emails for this page."
      : mobileScore != null
        ? `Your mobile score is ${mobileScore} now. With this setting you'd get one email if it falls to ${Math.max(0, mobileScore - alertDrop)} or lower.`
        : `You'd get one email when the mobile score falls ${alertDrop} or more points below its usual level.`;

  function save() {
    start(async () => {
      const r = await updateSite(site.id, { name, alertDrop, isPublic });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Settings saved");
      setOpen(false);
      router.refresh();
    });
  }

  const tabs: { id: Tab; label: string; icon: typeof Bell }[] = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "deploys", label: "Deploys", icon: Rocket },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-raised px-3 text-sm font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
        <Settings2 className="size-4" aria-hidden /> Settings
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-border-strong bg-popover sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings · {site.name}</DialogTitle>
          <DialogDescription className="sr-only">General settings, email alerts and deploy tracking for this page.</DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Settings sections" className="mt-1 flex gap-1 rounded-lg border border-border bg-surface p-0.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground",
                tab === id && "bg-raised text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <div role="tabpanel" className="mt-4 space-y-6">
            <div>
              <label htmlFor="site-name" className="text-sm font-medium text-foreground">Name</label>
              <input
                id="site-name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </div>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span>
                <span className="block text-sm font-medium text-foreground">Public report link</span>
                <span className="block text-xs text-subtle">Lets you share a read-only report with your team or client. Settings stay private.</span>
                {isPublic && <span className="mt-1 block truncate font-mono text-xs text-brand">{`${appUrl}/r/${site.id}`}</span>}
              </span>
            </label>
            <SaveButton pending={pending} onClick={save} />

            <div className="border-t border-border pt-5">
              {confirmDelete ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-sm text-foreground">Delete {site.name} and its whole history? This can&apos;t be undone.</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        start(async () => {
                          const r = await deleteSite(site.id);
                          if (!r.ok) return void toast.error(r.error);
                          toast.success(`${site.name} deleted`);
                          router.push("/dashboard");
                          // The sidebar lives in the shared layout; re-fetch it so the site disappears there too.
                          router.refresh();
                        })
                      }
                      className="h-8 rounded-md bg-destructive px-3 text-xs font-medium text-white"
                    >
                      Delete site
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="h-8 rounded-md px-3 text-xs text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline">
                  <Trash2 className="size-3.5" aria-hidden /> Delete this site
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "alerts" && (
          <div role="tabpanel" className="mt-4 space-y-5">
            <p className="text-sm text-muted-foreground">
              We test this page every day. If the mobile score falls clearly below its usual level (the median of the last 7 runs), we email you once, with
              the numbers and a link to what changed.
            </p>
            <fieldset>
              <legend className="text-sm font-medium text-foreground">How sensitive?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {LEVELS.map((l) => (
                  <label
                    key={l.value}
                    className={cn(
                      "cursor-pointer rounded-lg border px-3 py-2.5 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                      alertDrop === l.value ? "border-brand/60 bg-brand/[0.06]" : "border-border hover:border-border-strong",
                    )}
                  >
                    <input type="radio" name="alert-level" className="sr-only" checked={alertDrop === l.value} onChange={() => setAlertDrop(l.value)} />
                    <span className="block text-sm font-medium text-foreground">{l.label}</span>
                    <span className="block text-xs text-subtle">{l.value ? `Drop of ${l.value}+ points. ${l.hint}` : l.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="rounded-lg bg-white/[0.03] px-3 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{level.label}:</span> {example}
            </p>
            <SaveButton pending={pending} onClick={save} />
          </div>
        )}

        {tab === "deploys" && (
          <div role="tabpanel" className="mt-4 space-y-5 text-sm">
            <div>
              <p className="font-medium text-foreground">Why record deploys?</p>
              <p className="mt-1 text-muted-foreground">
                Every release gets a marker on the chart and its own before/after score. When the site gets slower, you see exactly which release did it.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3.5">
              <p className="font-medium text-foreground">1. By hand (no setup)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use <span className="text-foreground">Record a deploy</span> in the Deploys section of the report whenever you release something.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3.5">
              <p className="font-medium text-foreground">2. Automatically from GitHub</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground marker:text-subtle">
                <li>
                  In your repo, open Settings → Secrets and variables → Actions, and add a secret named{" "}
                  <span className="font-mono text-foreground">VITALSWATCH_TOKEN</span> with this value:
                  <span className="mt-1.5 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded border border-border bg-screen px-2 py-1 font-mono text-[11px] text-foreground">{token}</code>
                    <CopyButton text={token} label="Copy" />
                  </span>
                </li>
                <li>Add this file to the repo. After every successful deploy, it records the release and we test the page.</li>
              </ol>
              <Snippet code={workflow} copyLabel="Copy file" title=".github/workflows/vitalswatch.yml" />
              <p className="mt-2 text-[11px] text-subtle">Works with Vercel, Netlify and any host that reports deployments to GitHub.</p>
            </div>
            <div>
              <button type="button" onClick={() => setShowCurl((v) => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn("size-3.5 transition-transform", showCurl && "rotate-180")} aria-hidden /> Another CI or a script
              </button>
              {showCurl && <Snippet code={curl} copyLabel="Copy command" />}
            </div>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const r = await rotateDeployToken(site.id);
                  if (!r.ok) return void toast.error(r.error);
                  setToken(r.token);
                  toast.success("New token created. Update the GitHub secret; the old one no longer works.");
                })
              }
              className="inline-flex items-center gap-1.5 text-xs text-subtle hover:text-foreground"
            >
              <RefreshCw className="size-3.5" aria-hidden /> Token leaked? Replace it
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SaveButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-white disabled:opacity-70"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Save changes
    </button>
  );
}
