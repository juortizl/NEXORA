import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@/lib/domain";

export async function createTRPCContext(opts: { headers: Headers }) {
  const session = await auth();
  return { db, session, headers: opts.headers };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Debes iniciar sesión" });
  }
  return next({ ctx: { ...ctx, session: ctx.session, user: ctx.session.user } });
});

export function roleProcedure(...roles: Role[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role as Role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permisos para esta acción" });
    }
    return next({ ctx });
  });
}

export const adminProcedure = roleProcedure("ADMIN");
export const managerProcedure = roleProcedure("ADMIN", "GERENTE_COMERCIAL");
