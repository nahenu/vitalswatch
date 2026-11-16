import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** False during SSR and the hydration render, true once React is interactive in the browser. */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
