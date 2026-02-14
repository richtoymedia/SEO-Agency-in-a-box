"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Plus, ExternalLink, Trash2 } from "lucide-react";

export default function BrandsPage() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSitemap, setNewSitemap] = useState("");

  const brandsQuery = trpc.brand.list.useQuery();
  const utils = trpc.useUtils();

  const createBrand = trpc.brand.create.useMutation({
    onSuccess: () => {
      toast("Brand created", "success");
      setShowCreate(false);
      setNewName("");
      setNewUrl("");
      setNewSitemap("");
      utils.brand.list.invalidate();
    },
    onError: (err) => toast(err.message, "error"),
  });

  const deleteBrand = trpc.brand.delete.useMutation({
    onSuccess: () => {
      toast("Brand deleted", "success");
      utils.brand.list.invalidate();
    },
    onError: (err) => toast(err.message, "error"),
  });

  const syncSitemap = trpc.brand.syncSitemap.useMutation({
    onSuccess: (data) => {
      toast(`Synced ${data.synced} pages from sitemap`, "success");
    },
    onError: (err) => toast(err.message, "error"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Brands</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Brand
        </Button>
      </div>

      {brandsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : brandsQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No brands yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {brandsQuery.data?.map((brand) => (
            <Card key={brand.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{brand.companyName}</CardTitle>
                  <div className="flex gap-1">
                    {brand.sitemapUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => syncSitemap.mutate({ brandId: brand.id })}
                        disabled={syncSitemap.isPending}
                      >
                        Sync Sitemap
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this brand?")) {
                          deleteBrand.mutate({ id: brand.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <a href={brand.siteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {brand.siteUrl}
                  </a>
                </div>
                <Link href={`/brands/${brand.id}`}>
                  <Button variant="link" size="sm" className="px-0 mt-2">Edit Settings</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogHeader>
          <DialogTitle>Create Brand</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createBrand.mutate({
                companyName: newName,
                siteUrl: newUrl,
                sitemapUrl: newSitemap || undefined,
              });
            }}
          >
            <div>
              <label className="text-sm font-medium">Company Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Site URL</label>
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com" required />
            </div>
            <div>
              <label className="text-sm font-medium">Sitemap URL (optional)</label>
              <Input value={newSitemap} onChange={(e) => setNewSitemap(e.target.value)} placeholder="https://example.com/sitemap.xml" />
            </div>
            <Button type="submit" disabled={createBrand.isPending}>Create</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
