import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { prisma } from "@/server/db";
import type { PrismaClient } from "@prisma/client";

export interface TRPCContext {
  userId: string | null;
  clerkOrgId: string | null;
  tenantId: string | null;
  prisma: PrismaClient;
}

export async function createTRPCContext(): Promise<TRPCContext> {
  // Auth context will be injected by the handler
  return {
    userId: null,
    clerkOrgId: null,
    tenantId: null,
    prisma,
  };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const tenantProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  if (!ctx.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No organization selected" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId as string,
      tenantId: ctx.tenantId as string,
      clerkOrgId: ctx.clerkOrgId as string,
    },
  });
});
