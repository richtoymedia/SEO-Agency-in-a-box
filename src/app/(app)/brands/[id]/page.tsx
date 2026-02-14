"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function BrandEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState("general");

  const brandQuery = trpc.brand.get.useQuery({ id });
  const utils = trpc.useUtils();

  const [form, setForm] = useState<Record<string, string>>({});

  // Initialize form when data loads
  const brand = brandQuery.data;
  if (brand && !form.companyName) {
    setForm({
      companyName: brand.companyName,
      siteUrl: brand.siteUrl,
      sitemapUrl: brand.sitemapUrl || "",
      voiceStyleJson: JSON.stringify(brand.voiceStyleJson, null, 2),
      seoSettingsJson: JSON.stringify(brand.seoSettingsJson, null, 2),
      imageDefaultsJson: JSON.stringify(brand.imageDefaultsJson, null, 2),
      internalLinkingJson: JSON.stringify(brand.internalLinkingJson, null, 2),
    });
  }

  const updateBrand = trpc.brand.update.useMutation({
    onSuccess: () => {
      toast("Brand updated", "success");
      utils.brand.get.invalidate({ id });
    },
    onError: (err) => toast(err.message, "error"),
  });

  const handleSave = () => {
    try {
      updateBrand.mutate({
        id,
        data: {
          companyName: form.companyName,
          siteUrl: form.siteUrl,
          sitemapUrl: form.sitemapUrl || undefined,
          voiceStyleJson: JSON.parse(form.voiceStyleJson || "{}"),
          seoSettingsJson: JSON.parse(form.seoSettingsJson || "{}"),
          imageDefaultsJson: JSON.parse(form.imageDefaultsJson || "{}"),
          internalLinkingJson: JSON.parse(form.internalLinkingJson || "{}"),
        },
      });
    } catch {
      toast("Invalid JSON in one of the fields", "error");
    }
  };

  if (brandQuery.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/brands">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">{form.companyName || "Edit Brand"}</h1>
        <Button className="ml-auto" onClick={handleSave} disabled={updateBrand.isPending}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="voice">Voice/Style</TabsTrigger>
          <TabsTrigger value="seo">SEO Settings</TabsTrigger>
          <TabsTrigger value="linking">Internal Linking</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Company Name</label>
                <Input value={form.companyName || ""} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Site URL</label>
                <Input value={form.siteUrl || ""} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Sitemap URL</label>
                <Input value={form.sitemapUrl || ""} onChange={(e) => setForm({ ...form, sitemapUrl: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice">
          <Card>
            <CardHeader><CardTitle>Voice & Style Settings</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.voiceStyleJson || "{}"}
                onChange={(e) => setForm({ ...form, voiceStyleJson: e.target.value })}
                rows={12}
                className="font-mono text-sm"
                placeholder='{"tone": "professional", "style": "conversational", "audience": "marketers"}'
              />
              <p className="text-xs text-muted-foreground mt-1">JSON format. Controls the writing style and tone of generated content.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader><CardTitle>SEO Settings</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.seoSettingsJson || "{}"}
                onChange={(e) => setForm({ ...form, seoSettingsJson: e.target.value })}
                rows={12}
                className="font-mono text-sm"
                placeholder='{"targetWordCount": 2000, "keywordDensity": 1.5, "headingStructure": "h2-h3"}'
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="linking">
          <Card>
            <CardHeader><CardTitle>Internal Linking Settings</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.internalLinkingJson || "{}"}
                onChange={(e) => setForm({ ...form, internalLinkingJson: e.target.value })}
                rows={12}
                className="font-mono text-sm"
                placeholder='{"maxLinks": 5, "preferredAnchors": [], "excludePatterns": []}'
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images">
          <Card>
            <CardHeader><CardTitle>Image Default Settings</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.imageDefaultsJson || "{}"}
                onChange={(e) => setForm({ ...form, imageDefaultsJson: e.target.value })}
                rows={12}
                className="font-mono text-sm"
                placeholder='{"style": "photorealistic", "aspectRatio": "16:9", "quality": "high"}'
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
