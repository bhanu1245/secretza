import type { AiSuggestion, RiskDiagnostic } from "@/lib/seo-studio-analysis";

export type ExportRow = {
  pageSlug: string;
  pageType: string;
  status: string;
  seoScore: number | string;
  uniqueness: number | string;
  duplicateRisk: string;
  wordCount: number | string;
  lastGenerated: string;
  recommendations: string;
};

export function rowsToCsv(rows: ExportRow[]): string {
  const headers = [
    "Page Slug",
    "Page Type",
    "Status",
    "SEO Score",
    "Uniqueness %",
    "Duplicate Risk",
    "Word Count",
    "Last Generated",
    "Recommendations",
  ];
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.pageSlug,
        r.pageType,
        r.status,
        r.seoScore,
        r.uniqueness,
        r.duplicateRisk,
        r.wordCount,
        r.lastGenerated,
        r.recommendations,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

export function formatRecommendations(
  diagnostics: RiskDiagnostic[],
  suggestions: AiSuggestion[],
): string {
  const parts = [
    ...diagnostics.map((d) => d.label),
    ...suggestions.slice(0, 3).map((s) => s.label),
  ];
  return parts.join("; ");
}
