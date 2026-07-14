"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { RiskDiagnostic } from "@/lib/seo-studio-analysis";

export function SeoStudioRiskBadge({
  risk,
  diagnostics = [],
  compact = false,
}: {
  risk: string | null | undefined;
  diagnostics?: RiskDiagnostic[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const r = (risk ?? "unknown").toLowerCase();
  const color =
    r === "high"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : r === "medium"
        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
        : r === "low"
          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
          : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

  if (compact || diagnostics.length === 0) {
    return (
      <Badge className={color}>{r === "unknown" ? "—" : r.toUpperCase()}</Badge>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-left"
      >
        <Badge className={color}>{r.toUpperCase()}</Badge>
        {open ? <ChevronDown className="size-3 text-[#71717A]" /> : <ChevronRight className="size-3 text-[#71717A]" />}
      </button>
      {open && (
        <ul className="text-xs text-[#A1A1AA] space-y-0.5 pl-1">
          {diagnostics.map((d) => (
            <li key={d.code} className="flex gap-1">
              <span className={d.severity === "high" ? "text-red-400" : d.severity === "medium" ? "text-amber-400" : "text-emerald-400"}>•</span>
              {d.label}
              {d.similarityPct != null && ` (${d.similarityPct}% similar)`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
