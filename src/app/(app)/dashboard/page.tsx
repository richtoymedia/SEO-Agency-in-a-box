"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Plus, Play, RefreshCw } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  IDLE: "secondary",
  QUEUED: "warning",
  RUNNING: "default",
  COMPLETED: "success",
  FAILED: "destructive",
};

export default function DashboardPage() {
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { toast } = useToast();

  const brandsQuery = trpc.brand.list.useQuery();
  const jobsQuery = trpc.job.list.useQuery(
    {
      ...(brandFilter ? { brandId: brandFilter } : {}),
      ...(statusFilter ? { status: statusFilter as "IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" } : {}),
    },
    { refetchInterval: 5000 }
  );

  const utils = trpc.useUtils();
  const enqueueBatch = trpc.job.enqueueGenerateBatch.useMutation({
    onSuccess: (data) => {
      toast(`Queued ${data.queued} jobs for generation`, "success");
      utils.job.list.invalidate();
    },
    onError: (err) => toast(err.message, "error"),
  });

  const idleJobs = jobsQuery.data?.filter((j) => j.status === "IDLE") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/jobs/new">
            <Button><Plus className="h-4 w-4 mr-1" /> New Job</Button>
          </Link>
          {idleJobs.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => enqueueBatch.mutate({ jobIds: idleJobs.map((j) => j.id) })}
              disabled={enqueueBatch.isPending}
            >
              <Play className="h-4 w-4 mr-1" />
              Generate All Idle ({idleJobs.length})
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={brandFilter} onValueChange={setBrandFilter} placeholder="All Brands">
          {brandsQuery.data?.map((b) => (
            <SelectOption key={b.id} value={b.id}>{b.companyName}</SelectOption>
          ))}
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter} placeholder="All Statuses">
          {["IDLE", "QUEUED", "RUNNING", "COMPLETED", "FAILED"].map((s) => (
            <SelectOption key={s} value={s}>{s}</SelectOption>
          ))}
        </Select>
        <Button variant="ghost" size="icon" onClick={() => jobsQuery.refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {jobsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : jobsQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No content jobs yet. <Link href="/jobs/new" className="underline">Create one</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobsQuery.data?.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4 px-6">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{job.topic}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.brand.companyName} &middot; {job.keywords.join(", ")}
                    </p>
                  </div>
                  <Badge variant={statusVariant[job.status]}>{job.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
