/**
 * SEO Review Studio — server-only dry-run scoring, regenerate/improve, quality gates.
 */
import "server-only";

import type { SEOContent } from "@/lib/seo-content";
import { resolveIntroContentForStorage } from "@/lib/seo-content";
import { calculateReadabilityScore } from "@/lib/readability";
import { pickSavePolicy } from "@/lib/seo-regen-save-policy";
import { getActiveSeoEngine } from "@/lib/seo-engine";
import { generateUniversalSeoContent } from "@/lib/seo-universal-engine";
import {
  computePageQualityMetrics,
  type SeoPageType,
} from "@/lib/seo-page-service";
import { diffHighlight } from "@/lib/seo-studio-analysis";
import {
  DEFAULT_QUALITY_SETTINGS,
  type CityPackQualitySettings,
  type CityPackReviewPage,
  type ReviewDashboard,
  type ReviewPageStatus,
} from "@/types/seo-review";

export type {
  ReviewPageStatus,
  CityPackQualitySettings,
  CityPackReviewPage,
  ReviewDashboard,
  ReviewPageRow,
  QualitySettings,
} from "@/types/seo-review";

export { DEFAULT_QUALITY_SETTINGS };

function classifyStatus(
  metrics: { seo: number; uniqueness: number; readability: number; duplicateRisk: string },
  settings: CityPackQualitySettings,
  flags: { regenerated?: boolean; improved?: boolean },
): ReviewPageStatus {
  if (flags.regenerated) return "regenerated";
  if (flags.improved) return "improved";
  const productionReady = isProductionReady(metrics, settings);
  if (productionReady) return "excellent";
  if (
    metrics.seo >= settings.minSeo &&
    metrics.uniqueness >= settings.minUniqueness &&
    metrics.readability >= settings.minReadability &&
    metrics.duplicateRisk !== "high"
  ) {
    return "ready";
  }
  return "needs_improvement";
}

export function isProductionReady(
  metrics: {
    seo: number;
    uniqueness: number;
    readability: number;
    duplicateRisk: string;
    localIntelligence?: boolean;
    validationIssues?: string[];
  },
  settings: CityPackQualitySettings,
): boolean {
  if (metrics.seo < settings.productionMinSeo) return false;
  if (metrics.uniqueness < settings.productionMinUniqueness) return false;
  if (metrics.readability < settings.productionMinReadability) return false;
  if (metrics.duplicateRisk === "high") return false;
  if (metrics.localIntelligence === false) return false;
  if (metrics.validationIssues && metrics.validationIssues.length > 0) return false;
  return true;
}

export function isWeakPage(
  page: Pick<CityPackReviewPage, "seo" | "uniqueness" | "readability">,
  settings: CityPackQualitySettings,
): boolean {
  return (
    page.seo < settings.minSeo ||
    page.uniqueness < settings.minUniqueness ||
    page.readability < settings.minReadability
  );
}

export function buildReviewDashboard(
  pages: CityPackReviewPage[],
  settings: CityPackQualitySettings,
): ReviewDashboard {
  const active = pages.filter((p) => p.status !== "skipped");
  const excellentCount = active.filter((p) => p.status === "excellent").length;
  const needsImprovementCount = active.filter(
    (p) => p.status === "needs_improvement" || !p.productionReady,
  ).length;
  const productionReadyCount = active.filter((p) => p.productionReady).length;
  const weakSeoCount = active.filter((p) => p.seo < settings.minSeo).length;
  const duplicateCount = active.filter((p) => p.duplicateRisk === "high").length;
  const wouldSaveCount = active.filter((p) => p.wouldSave && p.productionReady).length;

  const avg = (fn: (p: CityPackReviewPage) => number) =>
    active.length > 0
      ? Math.round(active.reduce((s, p) => s + fn(p), 0) / active.length)
      : null;

  const avgSeo = avg((p) => p.seo);
  const avgUniqueness = avg((p) => p.uniqueness);
  const avgReadability = avg((p) => p.readability);

  let estimatedQuality: ReviewDashboard["estimatedQuality"] = "Poor";
  if (avgSeo != null && avgSeo >= 90 && (avgUniqueness ?? 0) >= 85) estimatedQuality = "Excellent";
  else if (avgSeo != null && avgSeo >= 80) estimatedQuality = "Good";
  else if (avgSeo != null && avgSeo >= 70) estimatedQuality = "Fair";

  return {
    pageCount: active.length,
    wouldSaveCount,
    excellentCount,
    needsImprovementCount,
    productionReadyCount,
    weakSeoCount,
    duplicateCount,
    avgSeo,
    avgUniqueness,
    avgReadability,
    estimatedQuality,
  };
}

export async function buildReviewPageFromGeneration(input: {
  pageType: SeoPageType;
  pageSlug: string;
  content: SEOContent;
  canonicalUrl: string;
  generationTimeMs: number;
  settings: CityPackQualitySettings;
  flags?: { regenerated?: boolean; improved?: boolean };
  priorSnapshot?: CityPackReviewPage["priorSnapshot"];
  rawMeta?: Record<string, unknown>;
}): Promise<CityPackReviewPage> {
  const introContent = resolveIntroContentForStorage(input.content);
  const metrics = await computePageQualityMetrics(
    input.pageType,
    input.pageSlug,
    input.content,
    introContent,
    { canonicalUrl: input.canonicalUrl },
  );

  const readability = calculateReadabilityScore(introContent);
  const evaluateSave = pickSavePolicy(getActiveSeoEngine());
  const saveDecision = evaluateSave({
    priorUniqueness: null,
    priorSeoScore: null,
    newUniqueness: metrics.uniquenessScore,
    newSeoScore: metrics.seoQualityScore,
    attemptsExhausted: true,
  });

  const localIntelligence = input.rawMeta?.localIntelligence !== false;
  const validationIssues: string[] = [];
  if (metrics.duplicateRisk === "high") validationIssues.push("High duplicate risk");
  if (metrics.uniquenessScore < input.settings.productionMinUniqueness) {
    validationIssues.push("Uniqueness below production threshold");
  }
  if (metrics.seoQualityScore < input.settings.productionMinSeo) {
    validationIssues.push("SEO score below production threshold");
  }
  if (readability < input.settings.productionMinReadability) {
    validationIssues.push("Readability below production threshold");
  }
  if (!localIntelligence) validationIssues.push("Local intelligence not incorporated");

  const metricBundle = {
    seo: metrics.seoQualityScore,
    uniqueness: metrics.uniquenessScore,
    readability,
    duplicateRisk: metrics.duplicateRisk,
    localIntelligence,
    validationIssues,
  };

  const productionReady = isProductionReady(metricBundle, input.settings);
  const status = classifyStatus(metricBundle, input.settings, input.flags ?? {});

  const aiNotes = [
    input.rawMeta?.engineVersion ? `Engine: ${input.rawMeta.engineVersion}` : null,
    typeof input.rawMeta?.attemptsUsed === "number" ? `Attempts: ${input.rawMeta.attemptsUsed}` : null,
    typeof input.rawMeta?.candidatesEvaluated === "number"
      ? `Candidates: ${input.rawMeta.candidatesEvaluated}`
      : null,
    productionReady ? "Production-ready" : "Needs improvement before commit",
  ]
    .filter(Boolean)
    .join(" · ");

  const page: CityPackReviewPage = {
    pageType: input.pageType,
    pageSlug: input.pageSlug,
    canonicalUrl: input.canonicalUrl,
    title: input.content.title,
    metaDescription: input.content.metaDescription,
    h1: input.content.h1,
    introPreview: introContent.slice(0, 500),
    uniqueness: metrics.uniquenessScore,
    seo: metrics.seoQualityScore,
    readability,
    wouldSave: saveDecision.save && productionReady,
    saveReason: productionReady ? saveDecision.reason : "Below production quality threshold",
    wordCount: metrics.wordCount,
    duplicateRisk: metrics.duplicateRisk,
    contentJson: JSON.stringify(input.content),
    status,
    productionReady,
    generatedAt: new Date().toISOString(),
    generationTimeMs: input.generationTimeMs,
    internalLinksCount: metrics.internalLinksCount,
    faqCount: input.content.faqs?.length ?? 0,
    localIntelligence,
    aiNotes,
    validationIssues,
    priorSnapshot: input.priorSnapshot,
  };

  if (input.priorSnapshot) {
    page.diff = {
      intro: diffHighlight(input.priorSnapshot.intro, introContent),
      seoDelta: metrics.seoQualityScore - input.priorSnapshot.seo,
      uniquenessDelta: metrics.uniquenessScore - input.priorSnapshot.uniqueness,
    };
  }

  return page;
}

export async function generateReviewPageContent(input: {
  pageType: SeoPageType;
  pageSlug: string;
  citySlug: string;
  mode: "generate" | "regenerate" | "optimize";
  settings: CityPackQualitySettings;
  retryTargets?: { seo?: number; uniqueness?: number };
}): Promise<{
  content: SEOContent;
  canonicalUrl: string;
  metadata: Record<string, unknown>;
  generationTimeMs: number;
}> {
  const maxRetries = input.settings.maxRetries;
  const targetSeo = input.retryTargets?.seo ?? input.settings.retryUntilSeo;
  const targetUniq = input.retryTargets?.uniqueness ?? input.settings.retryUntilUniqueness;

  let best: Awaited<ReturnType<typeof generateUniversalSeoContent>> | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const genInput =
      input.pageType === "city"
        ? {
            pageType: "city" as const,
            citySlug: input.citySlug,
            mode: input.mode,
          }
        : {
            pageType: input.pageType,
            pageSlug: input.pageSlug,
            mode: input.mode,
          };

    const result = await generateUniversalSeoContent(genInput);
    const intro = resolveIntroContentForStorage(result.content);
    const metrics = await computePageQualityMetrics(
      input.pageType,
      input.pageSlug,
      result.content,
      intro,
      { canonicalUrl: result.canonicalUrl ?? `/${input.pageSlug}` },
    );

    const composite = metrics.seoQualityScore + metrics.uniquenessScore * 0.5;
    if (composite > bestScore) {
      bestScore = composite;
      best = result;
    }

    const meetsSeo = targetSeo == null || metrics.seoQualityScore >= targetSeo;
    const meetsUniq = targetUniq == null || metrics.uniquenessScore >= targetUniq;
    if (meetsSeo && meetsUniq) break;
  }

  if (!best) throw new Error("Generation failed");

  return {
    content: best.content,
    canonicalUrl: best.canonicalUrl ?? `/${input.pageSlug}`,
    metadata: (best.metadata as Record<string, unknown>) ?? {},
    generationTimeMs: best.generationTimeMs,
  };
}

export function serializeReviewPageForApi(page: CityPackReviewPage, includeContent = false) {
  return {
    pageType: page.pageType,
    pageSlug: page.pageSlug,
    canonicalUrl: page.canonicalUrl,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    introPreview: page.introPreview,
    uniqueness: page.uniqueness,
    seo: page.seo,
    readability: page.readability,
    wouldSave: page.wouldSave,
    saveReason: page.saveReason,
    wordCount: page.wordCount,
    duplicateRisk: page.duplicateRisk,
    status: page.status,
    productionReady: page.productionReady,
    generatedAt: page.generatedAt,
    generationTimeMs: page.generationTimeMs,
    internalLinksCount: page.internalLinksCount,
    faqCount: page.faqCount,
    localIntelligence: page.localIntelligence,
    aiNotes: page.aiNotes,
    validationIssues: page.validationIssues,
    diff: page.diff,
    content: includeContent ? (JSON.parse(page.contentJson) as SEOContent) : undefined,
  };
}
