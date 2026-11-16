"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ReactLenis } from "lenis/react";
import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/ui/sonner";
import "lenis/dist/lenis.css";

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Lenis smooth scrolling (off for people who ask for reduced motion), Motion
 * respecting the same setting, and toasts.
 */
export function Providers({ children }: { children: ReactNode }) {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED).matches,
    () => true,
  );

  // Lenis is a sibling, not a wrapper: toggling it never remounts the page.
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster position="bottom-right" />
      {!reduced && (
        <ReactLenis
          root
          options={{
            lerp: 0.09,
            anchors: { offset: -88 },
            // Let dialogs, menus and other inner scroll areas scroll natively.
            prevent: (node) => !!node.closest("[role=dialog], [data-radix-popper-content-wrapper]"),
          }}
        />
      )}
    </MotionConfig>
  );
}
