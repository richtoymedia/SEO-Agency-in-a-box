import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/server/db";

export async function getAuthContext() {
  const session = await auth();
  if (!session?.userId) {
    throw new Error("Not authenticated");
  }
  
  const orgId = session.orgId;
  if (!orgId) {
    return { userId: session.userId, clerkOrgId: null, tenantId: null, tenant: null };
  }

  // Auto-create tenant if missing
  let tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!tenant) {
    const user = await currentUser();
    tenant = await prisma.tenant.create({
      data: {
        clerkOrgId: orgId,
        name: session.orgSlug || user?.firstName || "Organization",
      },
    });
  }

  return {
    userId: session.userId,
    clerkOrgId: orgId,
    tenantId: tenant.id,
    tenant,
  };
}
