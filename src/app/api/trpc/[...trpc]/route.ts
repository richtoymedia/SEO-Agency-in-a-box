import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers";
import { getDefaultTenant } from "@/server/auth";
import { prisma } from "@/server/db";

async function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const { userId, clerkOrgId, tenantId } = await getDefaultTenant();
      return { userId, clerkOrgId, tenantId, prisma };
    },
  });
}

export { handler as GET, handler as POST };
