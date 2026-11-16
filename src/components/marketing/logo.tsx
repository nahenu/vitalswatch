import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" fill="#f4f4f5" />
      <path d="M5 17.5h5.2l2.6-6.5 4.4 11 2.8-7.2 1.6 2.7H27" fill="none" stroke="#09090b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-md text-[15px] font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <LogoMark />
      VitalsWatch
    </Link>
  );
}
