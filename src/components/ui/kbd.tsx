import { cn } from "cn";

/** A single keycap: sans type, a soft bottom edge so it reads as a physical key. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-white px-1.5 font-sans text-[11px] leading-none font-medium text-foreground/80 shadow-[inset_0_-1px_0_var(--color-border)]",
        className,
      )}
      {...props}
    />
  );
}

/** A key combination, e.g. ["Ctrl", "Shift", "Z"], rendered as separate keycaps. */
export function KbdGroup({ keys, className }: { keys: readonly string[]; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}
