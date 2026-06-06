"use client";

import { SEO_MIN_WORD_COUNT, type SeoQualityResult } from "@/lib/seo-quality";

interface SeoQualityMeterProps {
  result: SeoQualityResult;
  loading?: boolean;
  /** Hide the per-metric breakdown row. */
  compact?: boolean;
  /** Hide the "what this means" + recommendations block. */
  hideTips?: boolean;
  className?: string;
}

function buildRecommendations(result: SeoQualityResult): string[] {
  const tips: string[] = [];
  if (!result.meetsMinWordCount) {
    tips.push(
      `Add more detail — aim for ${SEO_MIN_WORD_COUNT}+ words (currently ${result.wordCount}).`,
    );
  }
  if (result.uniquenessScore < 70) {
    tips.push("Make your copy more unique — avoid generic, templated phrasing.");
  }
  if (result.duplicateRisk === "high") {
    tips.push("High duplicate risk — rewrite repeated sections in your own words.");
  }
  if (tips.length === 0) {
    tips.push("Looking good — your content is well optimized.");
  }
  return tips;
}

function scoreColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 50) return "#EAB308";
  return "#EF4444";
}

const RISK_LABEL: Record<string, { label: string; color: string }> = {
  low: { label: "Low duplicate risk", color: "#22C55E" },
  medium: { label: "Medium duplicate risk", color: "#EAB308" },
  high: { label: "High duplicate risk", color: "#EF4444" },
};

/**
 * Presentational SEO quality meter. Reused in listing create/edit and the
 * admin SEO editor. Fed by useSeoQualityScore — contains no scoring logic.
 */
export default function SeoQualityMeter({
  result,
  loading = false,
  compact = false,
  hideTips = false,
  className = "",
}: SeoQualityMeterProps) {
  const score = result.seoQualityScore;
  const color = scoreColor(score);
  const risk = RISK_LABEL[result.duplicateRisk] ?? RISK_LABEL.low;
  const tips = buildRecommendations(result);

  return (
    <div className={`rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#A1A1AA]">
          SEO Quality Score{loading ? " (updating…)" : ""}
        </span>
        <span className="text-sm font-bold" style={{ color }}>
          {score}/100
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: color }}
        />
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8B8B96]">
          <span>{result.wordCount} words{result.meetsMinWordCount ? "" : " (low)"}</span>
          <span>Uniqueness {result.uniquenessScore}%</span>
          {result.faqCount > 0 && <span>{result.faqCount} FAQs</span>}
          {result.internalLinksCount > 0 && <span>{result.internalLinksCount} links</span>}
          <span style={{ color: risk.color }}>{risk.label}</span>
        </div>
      )}
      {!hideTips && (
        <div className="mt-2 border-t border-[rgba(255,255,255,0.06)] pt-2">
          <p className="text-[10px] text-[#8B8B96]">
            Higher scores rank better — aim for <span className="text-[#A1A1AA]">75+</span>. Target length: {SEO_MIN_WORD_COUNT}+ words.
          </p>
          <ul className="mt-1 space-y-0.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-[10px] text-[#8B8B96]">• {tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
