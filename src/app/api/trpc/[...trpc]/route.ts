import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/server/db";

async function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await auth();
      const userId = session?.userId || null;
      const clerkOrgId = session?.orgId || null;

      let tenantId: string | null = null;
      if (clerkOrgId) {
        let tenant = await prisma.tenant.findUnique({
          where: { clerkOrgId },
        });
        if (!tenant) {
          tenant = await prisma.tenant.create({
            data: {
              clerkOrgId,
              name: session?.orgSlug || "Organization",
            },
          });
        }
        tenantId = tenant.id;
      }

      return { userId, clerkOrgId, tenantId, prisma };
    },
  });
}

export { handler as GET, handler as POST };
