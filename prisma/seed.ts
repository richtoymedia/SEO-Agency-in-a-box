import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed: No static lookup tables to seed.");
  console.log("Tenants are auto-created from Clerk orgs.");
  console.log("Use the app UI to create brands and jobs after signing in.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
