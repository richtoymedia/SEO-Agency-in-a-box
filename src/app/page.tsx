import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

export default async function LandingPage() {
  const session = await auth();
  if (session?.userId && session?.orgId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-10 w-10" />
        <h1 className="text-4xl font-bold">SEO Agency In A Box</h1>
      </div>
      <p className="max-w-md text-center text-lg text-muted-foreground">
        AI-powered content creation and SEO optimization platform for agencies.
      </p>
      <div className="flex gap-4">
        <Link href="/sign-in">
          <Button size="lg">Sign In</Button>
        </Link>
        <Link href="/sign-up">
          <Button size="lg" variant="outline">Sign Up</Button>
        </Link>
      </div>
    </div>
  );
}
