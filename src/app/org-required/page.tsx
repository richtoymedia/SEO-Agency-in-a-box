import { OrganizationList } from "@clerk/nextjs";

export default function OrgRequiredPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Select or Create an Organization</h1>
      <p className="text-muted-foreground">
        You need to be part of an organization to use SEO Agency.
      </p>
      <OrganizationList
        afterSelectOrganizationUrl="/dashboard"
        afterCreateOrganizationUrl="/dashboard"
      />
    </div>
  );
}
