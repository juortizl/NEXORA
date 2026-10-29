"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true sólo después de hidratar en el cliente (evita desajustes SSR/CSR). */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
