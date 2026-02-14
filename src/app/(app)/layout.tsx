import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.userId) {
    redirect("/sign-in");
  }

  if (!session?.orgId) {
    redirect("/org-required");
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="container py-6">{children}</main>
    </div>
  );
}
