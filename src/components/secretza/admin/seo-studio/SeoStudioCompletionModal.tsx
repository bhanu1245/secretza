"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { BatchCompletionReport } from "./types";

export function SeoStudioCompletionModal({
  open,
  onOpenChange,
  report,
  runId,
  onViewChanged,
  isDryRun = false,
  onCommitAll,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  report: BatchCompletionReport | null;
  runId: string;
  onViewChanged: () => void;
  isDryRun?: boolean;
  onCommitAll?: () => void;
  onDiscard?: () => void;
}) {
  if (!report) return null;

  const priorU = report.averagePriorUniqueness;
  const newU = report.averageUniqueness;
  const priorS = report.averagePriorSeoScore;
  const newS = report.averageSeoScore;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141419] border-[rgba(255,255,255,0.08)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7]">
            {isDryRun ? "Dry Run Complete" : "Regeneration Complete"}
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            {report.pagesProcessed} pages processed
            {isDryRun && " — no changes written yet"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#0B0B0F] p-3">
              <p className="text-[#71717A] text-xs">Average uniqueness</p>
              <p className="text-emerald-400 font-semibold">
                {priorU != null ? `${Math.round(priorU)}%` : "—"} → {newU != null ? `${Math.round(newU)}%` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-[#0B0B0F] p-3">
              <p className="text-[#71717A] text-xs">Average SEO</p>
              <p className="text-emerald-400 font-semibold">
                {priorS != null ? Math.round(priorS) : "—"} → {newS != null ? Math.round(newS) : "—"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <p className="text-[#A1A1AA]"><span className="text-emerald-400 font-medium">{report.pagesImproved}</span> pages improved</p>
            <p className="text-[#A1A1AA]"><span className="text-amber-400 font-medium">{report.pagesUnchanged}</span> unchanged</p>
            <p className="text-[#A1A1AA]"><span className="text-[#71717A] font-medium">{report.pagesSkipped}</span> skipped</p>
            <p className="text-[#A1A1AA]"><span className="text-red-400 font-medium">{report.failures}</span> failures</p>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {isDryRun ? (
            <>
              <Button size="sm" onClick={() => { onCommitAll?.(); onOpenChange(false); }}>
                ✅ Commit Changes
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { onDiscard?.(); onOpenChange(false); }}>
                ❌ Discard
              </Button>
              <Button size="sm" variant="outline" onClick={onViewChanged}>
                Review previews
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/seo/regenerate/${runId}/export?format=csv`, "_blank")}
              >
                <Download className="size-3 mr-1" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/seo/regenerate/${runId}/export?format=json`, "_blank")}
              >
                <Download className="size-3 mr-1" /> JSON
              </Button>
              <Button size="sm" variant="outline" onClick={onViewChanged}>
                View changed pages
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
