import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A styled native <select>: tiny, accessible, and uses the OS picker on phones. */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        {...props}
        className="h-9 w-full appearance-none truncate rounded-lg border border-input bg-white pl-3 pr-8 text-sm text-foreground outline-none transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
