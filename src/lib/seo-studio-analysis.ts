/**
 * SEO Studio — diagnostics, score breakdown, AI suggestions, diffs.
 */
import {
  analyzeSeoContent,
  computeSeoQualityScore,
  textSimilarity,
  type DuplicateFieldFlags,
  type SeoQualityInput,
} from "@/lib/seo-quality";
import { semanticSimilarity } from "@/lib/seo-uniqueness-engine";
import { extractFingerprintParagraphs } from "@/lib/seo-paragraph-fingerprints";
import { calculateReadabilityScore } from "@/lib/readability";

export type RiskDiagnostic = {
  code: string;
  label: string;
  severity: "high" | "medium" | "low";
  detail?: string;
  similarityPct?: number;
};

export type AiSuggestion = {
  id: string;
  label: string;
  description: string;
  estimatedGain: number;
  priority: "high" | "medium" | "low";
};

export type ScoreBreakdownItem = {
  key: string;
  label: string;
  score: number;
  max: number;
  status: "good" | "warn" | "bad";
};

export type DuplicateHeatmapEntry = {
  slug: string;
  pageType: string;
  similarityPct: number;
};

export type ParagraphDuplicateEntry = {
  paragraphIndex: number;
  paragraphPreview: string;
  conflictSlug: string;
  conflictPageType: string;
  similarityPct: number;
};

export function extractHeadings(markdown: string | null | undefined): {
  h2: string[];
  h3: string[];
} {
  const h2: string[] = [];
  const h3: string[] = [];
  if (!markdown) return { h2, h3 };
  for (const line of markdown.split("\n")) {
    const h2m = line.match(/^##\s+(.+)/);
    if (h2m) {
      h2.push(h2m[1].trim());
      continue;
    }
    const h3m = line.match(/^###\s+(.+)/);
    if (h3m) h3.push(h3m[1].trim());
  }
  return { h2, h3 };
}

export function countLinksInContent(content: string | null | undefined) {
  if (!content) return { internal: 0, external: 0 };
  const internal = (content.match(/\]\(\/(?!\/)/g) ?? []).length;
  const external = (content.match(/\]\(https?:\/\//g) ?? []).length;
  return { internal, external };
}

export function buildRiskDiagnostics(input: {
  duplicateRisk?: string | null;
  uniquenessScore?: number | null;
  wordCount?: number | null;
  duplicateFields?: DuplicateFieldFlags;
  maxIntroSimilarity?: number;
  pageType?: string;
  introContent?: string | null;
}): RiskDiagnostic[] {
  const reasons: RiskDiagnostic[] = [];
  const dup = input.duplicateFields;
  const uniq = input.uniquenessScore ?? 0;
  const sim = input.maxIntroSimilarity ?? (100 - uniq) / 100;

  if (dup?.introContent) {
    reasons.push({
      code: "duplicate_intro",
      label: "Duplicate intro",
      severity: "high",
      similarityPct: Math.round(sim * 100),
    });
  }
  if (dup?.faqContent) {
    reasons.push({ code: "duplicate_faq", label: "Duplicate FAQ", severity: "high" });
  }
  if (dup?.title) {
    reasons.push({ code: "duplicate_title", label: "Duplicate title / CTA pattern", severity: "medium" });
  }
  if (dup?.metaDescription) {
    reasons.push({ code: "duplicate_meta", label: "Duplicate meta description", severity: "medium" });
  }
  if (dup?.h1) {
    reasons.push({ code: "duplicate_h1", label: "Duplicate H1", severity: "medium" });
  }
  if (uniq < 50) {
    reasons.push({
      code: "low_uniqueness",
      label: "Low uniqueness",
      severity: "high",
      detail: `${uniq.toFixed(0)}% unique`,
      similarityPct: Math.round(sim * 100),
    });
  } else if (uniq < 70) {
    reasons.push({
      code: "moderate_uniqueness",
      label: "Moderate uniqueness",
      severity: "medium",
      similarityPct: Math.round(sim * 100),
    });
  }
  if ((input.wordCount ?? 0) < 500) {
    reasons.push({
      code: "thin_content",
      label: "Thin location content",
      severity: "high",
      detail: `${input.wordCount ?? 0} words`,
    });
  }
  if (input.pageType === "city" && input.introContent) {
    const hasLocal =
      /\b(district|landmark|metro|neighbourhood|neighborhood|local|area|ward)\b/i.test(
        input.introContent,
      );
    if (!hasLocal) {
      reasons.push({
        code: "missing_local_refs",
        label: "Missing local references",
        severity: "medium",
      });
    }
  }
  if (!input.introContent?.trim()) {
    reasons.push({ code: "missing_content", label: "Missing intro content", severity: "high" });
  }

  const risk = (input.duplicateRisk ?? "low").toLowerCase();
  if (reasons.length === 0 && risk === "high") {
    reasons.push({
      code: "high_risk_generic",
      label: "High duplicate risk",
      severity: "high",
      similarityPct: Math.round(sim * 100),
    });
  }

  return reasons;
}

export function buildAiSuggestions(input: {
  wordCount?: number | null;
  faqCount?: number | null;
  uniquenessScore?: number | null;
  duplicateFields?: DuplicateFieldFlags;
  introContent?: string | null;
  diagnostics: RiskDiagnostic[];
}): AiSuggestion[] {
  const suggestions: AiSuggestion[] = [];
  const wc = input.wordCount ?? 0;
  const faq = input.faqCount ?? 0;
  const uniq = input.uniquenessScore ?? 100;

  if (input.diagnostics.some((d) => d.code === "missing_local_refs")) {
    suggestions.push({
      id: "local_landmarks",
      label: "Add local landmarks",
      description: "Reference districts, transport hubs, and well-known areas.",
      estimatedGain: 8,
      priority: "high",
    });
  }
  if (wc < 500) {
    suggestions.push({
      id: "increase_length",
      label: "Increase content length",
      description: `Target 650+ words (currently ${wc}).`,
      estimatedGain: 12,
      priority: "high",
    });
  }
  if (uniq < 70 || input.duplicateFields?.introContent) {
    suggestions.push({
      id: "rewrite_intro",
      label: "Rewrite intro",
      description: "Replace template paragraphs with city-specific narrative.",
      estimatedGain: 15,
      priority: "high",
    });
  }
  if (faq < 3) {
    suggestions.push({
      id: "add_faqs",
      label: "Add FAQs",
      description: "Add 5+ location-specific questions.",
      estimatedGain: 10,
      priority: "medium",
    });
  }
  if (uniq < 55) {
    suggestions.push({
      id: "reduce_repetition",
      label: "Reduce repetition",
      description: "Vary sentence openings and remove duplicated phrases.",
      estimatedGain: 9,
      priority: "high",
    });
  }
  if (!/nightlife|evening|dining|entertainment/i.test(input.introContent ?? "")) {
    suggestions.push({
      id: "nightlife_section",
      label: "Add nightlife section",
      description: "Add an H2 covering evening venues and social scene.",
      estimatedGain: 5,
      priority: "low",
    });
  }
  suggestions.push({
    id: "keyword_density",
    label: "Improve keyword density",
    description: "Naturally weave primary city + category keywords in H2s.",
    estimatedGain: 6,
    priority: "medium",
  });
  if (input.introContent) {
    const readability = calculateReadabilityScore(input.introContent);
    if (readability > 0 && readability < 50) {
      suggestions.push({
        id: "readability",
        label: "Improve readability",
        description: "Shorten sentences and break up long paragraphs.",
        estimatedGain: 4,
        priority: "low",
      });
    }
  }

  return suggestions.slice(0, 8);
}

export function buildScoreBreakdown(
  input: SeoQualityInput & { introContent?: string | null },
): ScoreBreakdownItem[] {
  const wc = input.wordCount;
  const wordScore = Math.round(Math.min(wc / 500, 1) * 25);
  const uniqScore = Math.round((input.uniquenessScore / 100) * 25);
  const linkScore = Math.round(Math.min(input.internalLinksCount / 5, 1) * 15);
  const faqScore = Math.round(Math.min(input.faqCount / 5, 1) * 15);

  let metaPts = 0;
  if (input.title?.trim()) metaPts += 4;
  if (input.metaDescription?.trim()) metaPts += 4;
  if (input.h1?.trim()) metaPts += 4;
  if (input.canonicalUrl?.trim()) metaPts += 4;
  if (input.featuredImage?.trim()) metaPts += 4;

  const readability =
    input.introContent && calculateReadabilityScore(input.introContent) > 0
      ? Math.min(100, calculateReadabilityScore(input.introContent!))
      : 50;

  const schema = 0;

  const status = (pct: number): "good" | "warn" | "bad" =>
    pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad";

  const overall = computeSeoQualityScore(input);

  return [
    { key: "title", label: "Title", score: input.title?.trim() ? 100 : 0, max: 100, status: input.title?.trim() ? "good" : "bad" },
    { key: "meta", label: "Meta", score: input.metaDescription?.trim() ? 100 : 0, max: 100, status: input.metaDescription?.trim() ? "good" : "bad" },
    { key: "keywords", label: "Keywords", score: uniqScore * 4, max: 100, status: status(uniqScore * 4) },
    { key: "readability", label: "Readability", score: readability, max: 100, status: status(readability) },
    { key: "headings", label: "Headings", score: input.h1?.trim() ? 100 : 0, max: 100, status: input.h1?.trim() ? "good" : "bad" },
    { key: "internal_links", label: "Internal Links", score: Math.round((linkScore / 15) * 100), max: 100, status: status((linkScore / 15) * 100) },
    { key: "images", label: "Images", score: input.featuredImage?.trim() ? 100 : 0, max: 100, status: input.featuredImage?.trim() ? "good" : "bad" },
    { key: "schema", label: "Schema", score: schema, max: 100, status: schema ? "good" : "bad" },
    { key: "canonical", label: "Canonical", score: input.canonicalUrl?.trim() ? 100 : 0, max: 100, status: input.canonicalUrl?.trim() ? "good" : "bad" },
    { key: "overall", label: "Overall", score: overall, max: 100, status: status(overall) },
  ];
}

/** Paragraph-level duplicate detection for V6 inspector. */
export function buildParagraphDuplicateHeatmap(
  intro: string | null | undefined,
  peers: Array<{ pageSlug: string; pageType: string; introContent: string | null }>,
  threshold = 0.2,
  limit = 20,
): ParagraphDuplicateEntry[] {
  if (!intro?.trim()) return [];
  const paragraphs = extractFingerprintParagraphs(intro);
  const entries: ParagraphDuplicateEntry[] = [];

  paragraphs.forEach((para, paragraphIndex) => {
    for (const peer of peers) {
      if (!peer.introContent?.trim()) continue;
      for (const peerPara of extractFingerprintParagraphs(peer.introContent)) {
        const sim = semanticSimilarity(para, peerPara);
        if (sim > threshold) {
          entries.push({
            paragraphIndex,
            paragraphPreview: para.slice(0, 120) + (para.length > 120 ? "…" : ""),
            conflictSlug: peer.pageSlug,
            conflictPageType: peer.pageType,
            similarityPct: Math.round(sim * 100),
          });
        }
      }
    }
  });

  return entries
    .sort((a, b) => b.similarityPct - a.similarityPct)
    .slice(0, limit);
}

export function buildDuplicateHeatmap(
  intro: string | null | undefined,
  peers: Array<{ pageSlug: string; pageType: string; introContent: string | null }>,
  limit = 12,
): DuplicateHeatmapEntry[] {
  if (!intro?.trim()) return [];
  return peers
    .map((p) => ({
      slug: p.pageSlug,
      pageType: p.pageType,
      similarityPct: Math.round(textSimilarity(intro, p.introContent ?? "") * 100),
    }))
    .filter((e) => e.similarityPct >= 25)
    .sort((a, b) => b.similarityPct - a.similarityPct)
    .slice(0, limit);
}

export function diffHighlight(oldText: string | null | undefined, newText: string | null | undefined) {
  const a = (oldText ?? "").trim();
  const b = (newText ?? "").trim();
  const changed = a !== b;
  return { old: a || "—", new: b || "—", changed };
}

export function analyzePageForStudio(page: {
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  introContent?: string | null;
  canonicalUrl?: string | null;
  featuredImage?: string | null;
  wordCount?: number | null;
  faqCount?: number | null;
  internalLinksCount?: number | null;
  uniquenessScore?: number | null;
  duplicateRisk?: string | null;
  duplicateFields?: DuplicateFieldFlags;
  pageType?: string;
  maxIntroSimilarity?: number;
}) {
  const qualityInput: SeoQualityInput = {
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    introContent: page.introContent,
    canonicalUrl: page.canonicalUrl,
    featuredImage: page.featuredImage,
    faqCount: page.faqCount ?? 0,
    internalLinksCount: page.internalLinksCount ?? 0,
    wordCount: page.wordCount ?? 0,
    uniquenessScore: page.uniquenessScore ?? 0,
    duplicateFields: page.duplicateFields ?? {
      title: false,
      metaDescription: false,
      h1: false,
      introContent: false,
      faqContent: false,
    },
  };

  const analysis = analyzeSeoContent(qualityInput, page.maxIntroSimilarity);
  const diagnostics = buildRiskDiagnostics({
    ...page,
    duplicateFields: analysis.duplicateFields,
    uniquenessScore: analysis.uniquenessScore,
    wordCount: analysis.wordCount,
  });
  const suggestions = buildAiSuggestions({
    wordCount: analysis.wordCount,
    faqCount: analysis.faqCount,
    uniquenessScore: analysis.uniquenessScore,
    duplicateFields: analysis.duplicateFields,
    introContent: page.introContent,
    diagnostics,
  });
  const scoreBreakdown = buildScoreBreakdown(qualityInput);
  const estimatedImprovement = Math.min(
    25,
    suggestions.reduce((s, x) => s + x.estimatedGain, 0) * 0.35,
  );

  return { analysis, diagnostics, suggestions, scoreBreakdown, estimatedImprovement };
}
