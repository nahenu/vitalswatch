import { Suspense, type ReactNode } from "react";
import { MobileBar, Sidebar } from "@/components/app/sidebar";
import { getSession } from "@/lib/auth";
import { listSites } from "@/lib/sites";

/** Console layout: a site rail on the left, the page on the right. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1">
      <Suspense fallback={<div className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block" />}>
        <SidebarWithData />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<MobileBar />}>
          <MobileBarWithUser />
        </Suspense>
        {children}
      </div>
    </div>
  );
}

// Signed-out visitors are redirected by the page itself, which knows where to send them back (?next=).
async function SidebarWithData() {
  const user = (await getSession())?.user;
  if (!user) return <div className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block" />;
  const sites = await listSites(user.id);
  return (
    <Sidebar
      user={{ name: user.name, email: user.email }}
      sites={sites.map((s) => ({ id: s.id, name: s.name, mobile: s.mobile, failing: !!s.lastError }))}
    />
  );
}

async function MobileBarWithUser() {
  const user = (await getSession())?.user;
  if (!user) return <MobileBar />;
  return <MobileBar user={{ name: user.name, email: user.email }} />;
}
