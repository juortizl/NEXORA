import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { createCaller } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";

/** Caller de tRPC para Server Components (sin HTTP). */
export const api = cache(async () => {
  const h = new Headers(await headers());
  h.set("x-trpc-source", "rsc");
  return createCaller(await createTRPCContext({ headers: h }));
});
