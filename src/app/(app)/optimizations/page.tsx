"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectOption } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Plus, Zap } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  IDLE: "secondary",
  QUEUED: "warning",
  RUNNING: "default",
  COMPLETED: "success",
  FAILED: "destructive",
};

export default function OptimizationsPage() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const brandsQuery = trpc.brand.list.useQuery();
  const jobsQuery = trpc.optimization.list.useQuery(undefined, { refetchInterval: 5000 });
  const utils = trpc.useUtils();

  const createJob = trpc.optimization.create.useMutation({
    onSuccess: (job) => {
      toast("Optimization job created", "success");
      setShowCreate(false);
      setBrandId("");
      setSourceUrl("");
      utils.optimization.list.invalidate();
    },
    onError: (err) => toast(err.message, "error"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Optimizations</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Optimization
        </Button>
      </div>

      {jobsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : jobsQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No optimization jobs yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobsQuery.data?.map((job) => (
            <Link key={job.id} href={`/optimizations/${job.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4 px-6">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{job.sourceUrl}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.brand.companyName}
                      {job.detectedKeyword && ` · ${job.detectedKeyword}`}
                    </p>
                  </div>
                  <Badge variant={statusVariant[job.status]}>{job.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogHeader>
          <DialogTitle>Create Optimization Job</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!brandId) { toast("Select a brand", "error"); return; }
              createJob.mutate({ brandId, sourceUrl });
            }}
          >
            <div>
              <label className="text-sm font-medium">Brand</label>
              <Select value={brandId} onValueChange={setBrandId} placeholder="Select a brand">
                {brandsQuery.data?.map((b) => (
                  <SelectOption key={b.id} value={b.id}>{b.companyName}</SelectOption>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Source URL to Optimize</label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/blog/my-article"
                required
              />
            </div>
            <Button type="submit" disabled={createJob.isPending}>Create</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
