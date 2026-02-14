import { prisma } from "@/server/db";

const DEFAULT_ORG_ID = "default-org";
const DEFAULT_USER_ID = "default-user";

export async function getDefaultTenant() {
  let tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId: DEFAULT_ORG_ID },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        clerkOrgId: DEFAULT_ORG_ID,
        name: "My Agency",
      },
    });
  }

  return {
    userId: DEFAULT_USER_ID,
    clerkOrgId: DEFAULT_ORG_ID,
    tenantId: tenant.id,
    tenant,
  };
}
