"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectOption } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2 } from "lucide-react";

export default function NewJobPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState("single");
  const [brandId, setBrandId] = useState("");

  // Single mode
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");

  // Batch mode
  const [batchText, setBatchText] = useState("");

  const brandsQuery = trpc.brand.list.useQuery();
  const createJob = trpc.job.create.useMutation({
    onSuccess: (job) => {
      toast("Job created", "success");
      router.push(`/jobs/${job.id}`);
    },
    onError: (err) => toast(err.message, "error"),
  });
  const createBatch = trpc.job.createBatch.useMutation({
    onSuccess: (jobs) => {
      toast(`Created ${jobs.length} jobs`, "success");
      router.push("/dashboard");
    },
    onError: (err) => toast(err.message, "error"),
  });

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) { toast("Select a brand", "error"); return; }
    createJob.mutate({
      brandId,
      topic,
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) { toast("Select a brand", "error"); return; }
    const lines = batchText.split("\n").filter(Boolean);
    const jobs = lines.map((line) => {
      const [t, ...kws] = line.split("|");
      return {
        topic: (t || "").trim(),
        keywords: kws.length > 0
          ? kws[0].split(",").map((k) => k.trim()).filter(Boolean)
          : [(t || "").trim()],
      };
    });
    createBatch.mutate({ brandId, jobs });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create Content Jobs</h1>

      <div>
        <label className="text-sm font-medium">Brand</label>
        <Select value={brandId} onValueChange={setBrandId} placeholder="Select a brand">
          {brandsQuery.data?.map((b) => (
            <SelectOption key={b.id} value={b.id}>{b.companyName}</SelectOption>
          ))}
        </Select>
      </div>

      <Tabs value={mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="single">Single Job</TabsTrigger>
          <TabsTrigger value="batch">Batch Create</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSingleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Topic</label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., How to improve page speed for e-commerce sites"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Keywords (comma-separated)</label>
                  <Input
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="e.g., page speed, core web vitals, e-commerce SEO"
                    required
                  />
                </div>
                <Button type="submit" disabled={createJob.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Create Job
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleBatchSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    One job per line: Topic | keyword1, keyword2, ...
                  </label>
                  <Textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={"How to improve page speed | page speed, core web vitals\nBest SEO tools for 2024 | SEO tools, best tools"}
                    rows={8}
                    required
                  />
                </div>
                <Button type="submit" disabled={createBatch.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Create Batch
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
