import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardSkeleton, SitesDashboard } from "@/components/app/sites-dashboard";
import { requireUser } from "@/lib/auth";
import { listSites } from "@/lib/sites";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-12">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}

async function DashboardContent() {
  const user = await requireUser("/dashboard");
  return <SitesDashboard sites={await listSites(user.id)} />;
}
