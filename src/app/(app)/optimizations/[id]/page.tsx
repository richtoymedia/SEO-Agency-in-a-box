"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useJobStream } from "@/lib/hooks/use-job-stream";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Play, RefreshCw, Copy, Check } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STEPS = [
  { key: "scrape", label: "Scrape" },
  { key: "detectKeyword", label: "Detect Keyword" },
  { key: "competitorResearch", label: "Competitor Research" },
  { key: "audit", label: "Audit" },
  { key: "rewrite", label: "Rewrite" },
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
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export default function OptimizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [tab, setTab] = useState("timeline");
  const utils = trpc.useUtils();

  const jobQuery = trpc.optimization.get.useQuery({ id }, { refetchInterval: 3000 });
  const stream = useJobStream(
    jobQuery.data?.status === "RUNNING" || jobQuery.data?.status === "QUEUED" ? id : null
  );

  const job = (stream.job as typeof jobQuery.data) || jobQuery.data;

  const run = trpc.optimization.run.useMutation({
    onSuccess: () => { toast("Optimization queued", "success"); utils.optimization.get.invalidate({ id }); },
    onError: (err) => toast(err.message, "error"),
  });

  const retry = trpc.optimization.retry.useMutation({
    onSuccess: () => { toast("Retrying optimization", "success"); utils.optimization.get.invalidate({ id }); },
    onError: (err) => toast(err.message, "error"),
  });

  if (jobQuery.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!job) return <p>Optimization job not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold truncate">{job.sourceUrl}</h1>
          <p className="text-muted-foreground">
            {job.detectedKeyword && `Keyword: ${job.detectedKeyword}`}
          </p>
        </div>
        <div className="flex gap-2">
          {job.status === "IDLE" && (
            <Button onClick={() => run.mutate({ id })} disabled={run.isPending}>
              <Play className="h-4 w-4 mr-1" /> Run
            </Button>
          )}
          {job.status === "FAILED" && (
            <Button variant="destructive" onClick={() => retry.mutate({ id })} disabled={retry.isPending}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
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

      {stream.isConnected && <p className="text-xs text-green-600">Live updates connected</p>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="scraped">Scraped Content</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="rewrite">Rewrite</TabsTrigger>
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
                      <span className="font-medium w-40">{step.label}</span>
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

        <TabsContent value="scraped">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Scraped Markdown</CardTitle>
                {job.scrapedMarkdown && <CopyButton text={job.scrapedMarkdown} />}
              </div>
            </CardHeader>
            <CardContent>
              {job.scrapedMarkdown ? (
                <div className="prose max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>{job.scrapedMarkdown}</Markdown>
                </div>
              ) : (
                <p className="text-muted-foreground">Not scraped yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors">
          <Card>
            <CardHeader><CardTitle>Competitor Research</CardTitle></CardHeader>
            <CardContent>
              {job.competitorBriefJson ? (
                <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(job.competitorBriefJson, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">Competitor research not completed yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>SEO Audit</CardTitle>
                {job.auditMarkdown && <CopyButton text={job.auditMarkdown} />}
              </div>
            </CardHeader>
            <CardContent>
              {job.auditMarkdown ? (
                <div className="prose max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>{job.auditMarkdown}</Markdown>
                </div>
              ) : (
                <p className="text-muted-foreground">Audit not completed yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewrite">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Optimized Rewrite</CardTitle>
                {job.optimizedRewriteMarkdown && <CopyButton text={job.optimizedRewriteMarkdown} />}
              </div>
            </CardHeader>
            <CardContent>
              {job.optimizedRewriteMarkdown ? (
                <div className="prose max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>{job.optimizedRewriteMarkdown}</Markdown>
                </div>
              ) : (
                <p className="text-muted-foreground">Rewrite not completed yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
