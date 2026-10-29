"use client";

import { useSession } from "next-auth/react";

export function useRole() {
  const { data } = useSession();
  const role = data?.user?.role ?? null;
  return {
    role,
    userId: data?.user?.id ?? null,
    isAdmin: role === "ADMIN",
    isManager: role === "ADMIN" || role === "GERENTE_COMERCIAL",
  };
}
