"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RepairEntry = {
  id: string;
  pageType: string;
  oldSlug: string;
  newSlug: string;
  willRepair: boolean;
  skipReason?: string;
};

type RepairPreview = {
  brokenCount: number;
  repairableCount: number;
  skipCount: number;
  entries: RepairEntry[];
};

type AdminSeoUrlRepairProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  disabled?: boolean;
};

export function SeoUrlRepairTrigger({
  onOpen,
  disabled,
}: {
  onOpen: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-lg"
    >
      <Wrench className="size-3 mr-1" />
      Repair SEO URL Structure
    </Button>
  );
}

export default function AdminSeoUrlRepair({
  open,
  onOpenChange,
  onComplete,
  disabled = false,
}: AdminSeoUrlRepairProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role?.toLowerCase() === "admin";

  const [preview, setPreview] = useState<RepairPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const isBusy = repairing || disabled;

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/admin/seo/repair-url-structure");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load preview");
      setPreview(data.preview ?? null);
    } catch (err) {
      setPreview(null);
      toast.error(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      return;
    }
    void fetchPreview();
  }, [open, fetchPreview]);

  const handleRepair = async () => {
    if (!preview || preview.repairableCount === 0) {
      toast.info("No repairable pages found");
      return;
    }

    setRepairing(true);
    try {
      const res = await fetch("/api/admin/seo/repair-url-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Repair failed");

      toast.success(
        `Repaired ${data.repaired} SEO page${data.repaired !== 1 ? "s" : ""}${
          data.skipped > 0 ? ` — skipped ${data.skipped}` : ""
        }`,
      );
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Repair failed");
    } finally {
      setRepairing(false);
    }
  };

  if (!isAdmin) return null;

  const examples = preview?.entries.filter((e) => e.willRepair).slice(0, 25) ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7] flex items-center gap-2">
            <Wrench className="size-4 text-orange-400" />
            Repair SEO URL Structure
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            Convert single-segment longtail slugs to the two-segment format used by public routing.
          </DialogDescription>
        </DialogHeader>

        {loadingPreview && (
          <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
            <Loader2 className="size-3 animate-spin" />
            Scanning for broken pages...
          </div>
        )}

        {preview && !loadingPreview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="text-[#F5F5F7]">
                Broken Pages Found: <strong>{preview.brokenCount}</strong>
              </span>
              <span className="text-emerald-400">
                Repairable: <strong>{preview.repairableCount}</strong>
              </span>
              {preview.skipCount > 0 && (
                <span className="text-amber-400">
                  Will Skip: <strong>{preview.skipCount}</strong>
                </span>
              )}
            </div>

            {examples.length > 0 ? (
              <div className="overflow-x-auto max-h-[280px] overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.08)]">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#0E0E17]">
                    <tr className="text-[#6B6B7A] border-b border-[rgba(255,255,255,0.06)]">
                      <th className="py-1.5 px-2 font-medium">Old Slug</th>
                      <th className="py-1.5 px-2 font-medium">New Slug</th>
                      <th className="py-1.5 px-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examples.map((entry) => (
                      <tr key={entry.id} className="border-b border-[rgba(255,255,255,0.04)]">
                        <td className="py-1.5 px-2 text-[#A1A1AA] font-mono">{entry.oldSlug}</td>
                        <td className="py-1.5 px-2 text-emerald-400 font-mono">{entry.newSlug}</td>
                        <td className="py-1.5 px-2 text-emerald-400">Repair</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#A1A1AA]">No broken single-segment SEO pages found.</p>
            )}

            {preview.skipCount > 0 && (
              <p className="text-[10px] text-[#6B6B7A]">
                {preview.skipCount} page(s) cannot be auto-repaired (conflict or unrecognized pattern).
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
            className="border-white/10 bg-transparent text-[#A1A1AA]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleRepair}
            disabled={!preview || preview.repairableCount === 0 || loadingPreview || isBusy}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {repairing ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Repairing...
              </>
            ) : (
              `Repair ${preview?.repairableCount ?? 0} Page${preview?.repairableCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
