"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { useJobStream } from "@/lib/hooks/use-job-stream";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Play, RefreshCw, Copy, Check, Repeat2 } from "lucide-react";
import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STEPS = [
  { key: "research", label: "Research" },
  { key: "imageSpecs", label: "Image Specs" },
  { key: "images", label: "Images" },
  { key: "article", label: "Article" },
  { key: "meta", label: "Meta" },
  { key: "thumbnail", label: "Thumbnail" },
  { key: "repurpose", label: "Repurpose" },
];

const stepStatusColors: Record<string, string> = {
  idle: "bg-gray-200",
  running: "bg-blue-400 animate-pulse",
  succeeded: "bg-green-500",
  failed: "bg-red-500",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [tab, setTab] = useState("timeline");
  const utils = trpc.useUtils();

  const jobQuery = trpc.job.get.useQuery({ id }, { refetchInterval: 3000 });
  const stream = useJobStream(
    jobQuery.data?.status === "RUNNING" || jobQuery.data?.status === "QUEUED" ? id : null
  );

  // Use streamed data if available, else query data
  const job = (stream.job as typeof jobQuery.data) || jobQuery.data;

  const enqueue = trpc.job.enqueueGenerate.useMutation({
    onSuccess: () => { toast("Job queued", "success"); utils.job.get.invalidate({ id }); },
    onError: (err) => toast(err.message, "error"),
  });

  const retry = trpc.job.retry.useMutation({
    onSuccess: () => { toast("Job retrying", "success"); utils.job.get.invalidate({ id }); },
    onError: (err) => toast(err.message, "error"),
  });

  const repurpose = trpc.job.repurpose.useMutation({
    onSuccess: () => { toast("Repurpose queued", "success"); utils.job.get.invalidate({ id }); },
    onError: (err) => toast(err.message, "error"),
  });

  if (jobQuery.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!job) return <p>Job not found.</p>;

  const meta = job.metaJson as { title?: string; description?: string; slug?: string } | null;
  const images = job.imageUrlsJson as string[] | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job.topic}</h1>
          <p className="text-muted-foreground">{(job as Record<string, unknown>).brand && typeof (job as Record<string, unknown>).brand === "object" ? ((job as Record<string, unknown>).brand as { companyName?: string })?.companyName : ""} &middot; {Array.isArray(job.keywords) ? job.keywords.join(", ") : ""}</p>
        </div>
        <div className="flex gap-2">
          {job.status === "IDLE" && (
            <Button onClick={() => enqueue.mutate({ jobId: id })} disabled={enqueue.isPending}>
              <Play className="h-4 w-4 mr-1" /> Generate
            </Button>
          )}
          {job.status === "FAILED" && (
            <Button variant="destructive" onClick={() => retry.mutate({ jobId: id })} disabled={retry.isPending}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          )}
          {job.status === "COMPLETED" && job.articleMarkdown && !job.repurposeJson && (
            <Button variant="secondary" onClick={() => repurpose.mutate({ jobId: id })} disabled={repurpose.isPending}>
              <Repeat2 className="h-4 w-4 mr-1" /> Repurpose
            </Button>
          )}
          <Badge variant={
            job.status === "COMPLETED" ? "success" :
            job.status === "FAILED" ? "destructive" :
            job.status === "RUNNING" ? "default" :
            job.status === "QUEUED" ? "warning" : "secondary"
          }>{job.status}</Badge>
        </div>
      </div>

      {stream.isConnected && (
        <p className="text-xs text-green-600">Live updates connected</p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="meta">Meta</TabsTrigger>
          <TabsTrigger value="repurpose">Repurpose</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {STEPS.map((step) => {
                  const status = (job as Record<string, unknown>)[`${step.key}Status`] as string || "idle";
                  const error = (job as Record<string, unknown>)[`${step.key}Error`] as string | null;
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${stepStatusColors[status] || "bg-gray-200"}`} />
                      <span className="font-medium w-28">{step.label}</span>
                      <span className="text-sm text-muted-foreground capitalize">{status}</span>
                      {error && <span className="text-xs text-red-500 truncate flex-1">{error}</span>}
                    </div>
                  );
                })}
              </div>
              {job.lastError && (
                <div className="mt-4 p-3 rounded bg-red-50 text-red-800 text-sm">
                  <strong>Last Error:</strong> {job.lastError}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Article</CardTitle>
                {job.articleMarkdown && <CopyButton text={job.articleMarkdown} />}
              </div>
            </CardHeader>
            <CardContent>
              {job.articleMarkdown ? (
                <div className="prose max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>{job.articleMarkdown}</Markdown>
                </div>
              ) : (
                <p className="text-muted-foreground">Article not generated yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="research">
          <Card>
            <CardHeader><CardTitle>Research Brief</CardTitle></CardHeader>
            <CardContent>
              {job.researchBriefJson ? (
                <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(job.researchBriefJson, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">Research not completed yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images">
          <Card>
            <CardHeader><CardTitle>Images</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {images?.map((url, i) => (
                  <img key={i} src={url} alt={`Generated image ${i + 1}`} className="rounded-lg w-full" />
                )) || <p className="text-muted-foreground col-span-2">No images generated yet.</p>}
              </div>
              {job.thumbnailUrl && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Thumbnail</h3>
                  <img src={job.thumbnailUrl} alt="Thumbnail" className="rounded-lg max-w-sm" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta">
          <Card>
            <CardHeader><CardTitle>SEO Meta</CardTitle></CardHeader>
            <CardContent>
              {meta ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Title</label>
                      <p className="font-medium">{meta.title}</p>
                    </div>
                    <CopyButton text={meta.title || ""} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p>{meta.description}</p>
                    </div>
                    <CopyButton text={meta.description || ""} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Slug</label>
                      <p className="font-mono text-sm">{meta.slug}</p>
                    </div>
                    <CopyButton text={meta.slug || ""} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Meta not generated yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repurpose">
          <Card>
            <CardHeader><CardTitle>Repurposed Content</CardTitle></CardHeader>
            <CardContent>
              {job.repurposeJson ? (
                <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(job.repurposeJson, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">Repurpose not completed yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
