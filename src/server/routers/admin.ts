import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { adminProcedure, managerProcedure, protectedProcedure, router } from "../trpc";
import { PresentationBlock, Role } from "@/lib/domain";

export const adminRouter = router({
  users: adminProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      where: { companyId: ctx.user.companyId },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { name: "asc" },
    })
  ),

  createUser: adminProcedure
    .input(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: Role }))
    .mutation(async ({ ctx, input }) => {
      const exists = await ctx.db.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Ya existe un usuario con ese correo" });
      return ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          role: input.role,
          companyId: ctx.user.companyId,
          passwordHash: await bcrypt.hash(input.password, 10),
        },
        select: { id: true, name: true, email: true, role: true },
      });
    }),

  updateUser: adminProcedure
    .input(z.object({ id: z.string(), role: Role.optional(), active: z.boolean().optional(), password: z.string().min(8).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...data } = input;
      return ctx.db.user.update({
        where: { id },
        data: { ...data, passwordHash: password ? await bcrypt.hash(password, 10) : undefined },
        select: { id: true, name: true, email: true, role: true, active: true },
      });
    }),

  presentations: protectedProcedure.input(z.object({ projectId: z.string() })).query(({ ctx, input }) =>
    ctx.db.presentation.findMany({ where: { projectId: input.projectId }, orderBy: { createdAt: "asc" } })
  ),

  savePresentation: managerProcedure
    .input(
      z.object({
        id: z.string().optional(),
        projectId: z.string(),
        name: z.string().min(1),
        isDefault: z.boolean().default(false),
        blocks: z.array(PresentationBlock),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, blocks, ...data } = input;
      if (input.isDefault) {
        await ctx.db.presentation.updateMany({ where: { projectId: input.projectId }, data: { isDefault: false } });
      }
      const payload = { ...data, blocks: JSON.stringify(blocks) };
      return id
        ? ctx.db.presentation.update({ where: { id }, data: payload })
        : ctx.db.presentation.create({ data: payload });
    }),

  auditLog: managerProcedure.input(z.object({ projectId: z.string(), take: z.number().int().max(200).default(50) })).query(({ ctx, input }) =>
    ctx.db.auditLog.findMany({
      where: { projectId: input.projectId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: input.take,
    })
  ),
});
