/**
 * SEO V6.2 — Universal Dry Run (preview-only, zero DB writes during preview).
 */
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { SEOContent } from "@/lib/seo-content";
import { resolveIntroContentForStorage } from "@/lib/seo-content";
import {
  buildUniversalGenerationMeta,
  generateUniversalSeoContent,
  SEO_V61_CONFIG,
  type UniversalSeoMode,
} from "@/lib/seo-universal-engine";
import { pickSavePolicy } from "@/lib/seo-regen-save-policy";
import { getActiveSeoEngine } from "@/lib/seo-engine";
import {
  computePageQualityMetrics,
  type SeoPageType,
} from "@/lib/seo-page-service";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";
import {
  buildLinkContextFromPage,
  sanitizeSeoContentLinks,
} from "@/lib/seo-internal-links";
import { getServedPathForSeoPage, isSeoPageRoutable } from "@/lib/seo-route-validation";
import { diffHighlight } from "@/lib/seo-studio-analysis";
import { calculateReadabilityScore } from "@/lib/readability";
import {
  findCachedPreviewByInput,
  hashDryRunInput,
  putDryRunPreview,
  putDryRunSession,
  getDryRunPreview,
  getDryRunSession,
  type DryRunBatchDashboard,
} from "@/lib/seo-dry-run-cache";
import { upsertFromContent } from "@/lib/seo-page-service";
import { snapshotContentVersion } from "@/lib/seo-regeneration-service";

export type SeoContentDiff = {
  intro: ReturnType<typeof diffHighlight>;
  h1: ReturnType<typeof diffHighlight>;
  meta: ReturnType<typeof diffHighlight>;
  faqs: ReturnType<typeof diffHighlight>;
  cta: ReturnType<typeof diffHighlight>;
  paragraphs: Array<{ index: number; old: string; new: string; changed: boolean }>;
};

export type SeoDryRunPreview = {
  previewId: string;
  sessionId?: string;
  pageType: string;
  pageSlug: string;
  seoPageId: string | null;
  mode: UniversalSeoMode;
  dryRun: true;
  previewOnly: true;
  wouldSave: boolean;
  meetsThreshold: boolean;
  saveReason: string;
  before: {
    uniqueness: number | null;
    seo: number | null;
    title: string | null;
    meta: string | null;
    h1: string | null;
    intro: string | null;
    faqs: Array<{ question: string; answer: string }>;
    wordCount: number | null;
    readability: number | null;
  };
  after: {
    uniqueness: number;
    seo: number;
    title: string;
    meta: string;
    h1: string;
    intro: string;
    faqs: Array<{ question: string; answer: string }>;
    wordCount: number;
    readability: number | null;
    internalLinksCount: number;
    duplicateRisk: string;
  };
  delta: {
    uniqueness: number | null;
    seo: number | null;
  };
  content: SEOContent;
  canonicalUrl: string;
  metadata: Record<string, unknown>;
  generationTimeMs: number;
  diff: SeoContentDiff;
  cached?: boolean;
};

function extractCta(intro: string): string {
  const blocks = intro.split(/\n\n+/);
  const last = blocks[blocks.length - 1]?.trim() ?? "";
  return last.length > 30 ? last : "";
}

function buildContentDiff(
  before: {
    title: string | null;
    meta: string | null;
    h1: string | null;
    intro: string | null;
    faqs: Array<{ question: string; answer: string }>;
  },
  after: {
    title: string;
    meta: string;
    h1: string;
    intro: string;
    faqs: Array<{ question: string; answer: string }>;
  },
): SeoContentDiff {
  const beforeFaqText = before.faqs.map((f) => `${f.question}\n${f.answer}`).join("\n\n");
  const afterFaqText = after.faqs.map((f) => `${f.question}\n${f.answer}`).join("\n\n");

  const oldParas = (before.intro ?? "").split(/\n\n+/).filter(Boolean);
  const newParas = after.intro.split(/\n\n+/).filter(Boolean);
  const maxLen = Math.max(oldParas.length, newParas.length);
  const paragraphs: SeoContentDiff["paragraphs"] = [];
  for (let i = 0; i < maxLen; i++) {
    const o = oldParas[i] ?? "";
    const n = newParas[i] ?? "";
    if (o !== n) {
      paragraphs.push({ index: i, old: o || "—", new: n || "—", changed: true });
    }
  }

  return {
    intro: diffHighlight(before.intro, after.intro),
    h1: diffHighlight(before.h1, after.h1),
    meta: diffHighlight(before.meta, after.meta),
    faqs: diffHighlight(beforeFaqText, afterFaqText),
    cta: diffHighlight(extractCta(before.intro ?? ""), extractCta(after.intro)),
    paragraphs,
  };
}

/** Run full V6.1 pipeline — read + generate + score + save policy. No writes. */
export async function buildSeoPagePreview(input: {
  pageType: string;
  pageSlug: string;
  mode?: UniversalSeoMode;
  useCache?: boolean;
}): Promise<SeoDryRunPreview | { ok: false; error: string; skipped?: boolean }> {
  const mode = input.mode ?? "regenerate";
  const inputKey = hashDryRunInput({
    pageType: input.pageType,
    pageSlug: input.pageSlug,
    mode,
    engine: SEO_V61_CONFIG.engine,
  });

  if (input.useCache !== false) {
    const cached = findCachedPreviewByInput<SeoDryRunPreview>(inputKey);
    if (cached) return { ...cached, cached: true };
  }

  const start = Date.now();
  const existing = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType: input.pageType, pageSlug: input.pageSlug } },
    include: { faqs: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });

  const priorUniqueness = existing?.uniquenessScore ?? null;
  const priorSeoScore = existing?.seoQualityScore ?? null;
  const beforeFaqs = existing?.faqs.map((f) => ({ question: f.question, answer: f.answer })) ?? [];

  if (existing) {
    const routeCheck = await isSeoPageRoutable({
      pageType: input.pageType,
      pageSlug: input.pageSlug,
      canonicalUrl: existing.canonicalUrl,
    });
    if (!routeCheck.routable) {
      return { ok: false, error: routeCheck.reason ?? "Page not routable", skipped: true };
    }
  }

  const generated = await generateUniversalSeoContent({
    pageType: input.pageType as SeoPageType,
    pageSlug: input.pageSlug,
    mode,
    excludePageId: existing?.id,
  });

  const linkContext = buildLinkContextFromPage(input.pageType, input.pageSlug);
  generated.content = await sanitizeSeoContentLinks(generated.content, linkContext);

  const introContent = resolveIntroContentForStorage(generated.content);
  // Cap peer set for scoring: 374 peers × textSimilarity loop ≈ 50s; 50 peers ≈ 7s
  const scoringPeers = (await getCachedPeerPages(input.pageType as SeoPageType, input.pageSlug)).slice(0, 50);
  const metrics = await computePageQualityMetrics(
    input.pageType as SeoPageType,
    input.pageSlug,
    generated.content,
    introContent,
    {
      featuredImage: existing?.featuredImage,
      canonicalUrl: generated.canonicalUrl ?? existing?.canonicalUrl ?? "",
      excludePageId: existing?.id,
      peers: scoringPeers,
    },
  );

  const evaluateSave = pickSavePolicy(getActiveSeoEngine());
  const saveDecision = evaluateSave({
    priorUniqueness,
    priorSeoScore,
    newUniqueness: metrics.uniquenessScore,
    newSeoScore: metrics.seoQualityScore,
    attemptsExhausted: true,
  });

  const generationMeta = buildUniversalGenerationMeta({
    mode,
    priorUniqueness,
    priorSeoScore,
    newUniqueness: metrics.uniquenessScore,
    newSeoScore: metrics.seoQualityScore,
    rawMeta: generated.metadata,
    generationTimeMs: Date.now() - start,
    requiresManualReview: saveDecision.requiresReview,
    failureReason: saveDecision.requiresReview ? saveDecision.reason : undefined,
  });

  const beforeIntro = existing?.introContent ?? "";
  const afterIntro = introContent;

  const preview: SeoDryRunPreview = {
    previewId: randomUUID(),
    pageType: input.pageType,
    pageSlug: input.pageSlug,
    seoPageId: existing?.id ?? null,
    mode,
    dryRun: true,
    previewOnly: true,
    wouldSave: saveDecision.save,
    meetsThreshold: saveDecision.meetsThreshold ?? false,
    saveReason: saveDecision.reason,
    before: {
      uniqueness: priorUniqueness,
      seo: priorSeoScore,
      title: existing?.title ?? null,
      meta: existing?.metaDescription ?? null,
      h1: existing?.h1 ?? null,
      intro: beforeIntro || null,
      faqs: beforeFaqs,
      wordCount: existing?.wordCount ?? null,
      readability: beforeIntro ? calculateReadabilityScore(beforeIntro) : null,
    },
    after: {
      uniqueness: metrics.uniquenessScore,
      seo: metrics.seoQualityScore,
      title: generated.content.title,
      meta: generated.content.metaDescription,
      h1: generated.content.h1,
      intro: afterIntro,
      faqs: generated.content.faqs,
      wordCount: metrics.wordCount,
      readability: calculateReadabilityScore(afterIntro),
      internalLinksCount: metrics.internalLinksCount,
      duplicateRisk: metrics.duplicateRisk,
    },
    delta: {
      uniqueness:
        priorUniqueness != null ? metrics.uniquenessScore - priorUniqueness : null,
      seo: priorSeoScore != null ? metrics.seoQualityScore - priorSeoScore : null,
    },
    content: generated.content,
    canonicalUrl: generated.canonicalUrl ?? "",
    metadata: {
      ...generationMeta,
      engineVersion: SEO_V61_CONFIG.engine,
    },
    generationTimeMs: Date.now() - start,
    diff: buildContentDiff(
      {
        title: existing?.title ?? null,
        meta: existing?.metaDescription ?? null,
        h1: existing?.h1 ?? null,
        intro: beforeIntro || null,
        faqs: beforeFaqs,
      },
      {
        title: generated.content.title,
        meta: generated.content.metaDescription,
        h1: generated.content.h1,
        intro: afterIntro,
        faqs: generated.content.faqs,
      },
    ),
  };

  putDryRunPreview(preview, inputKey);
  return preview;
}

function aggregateDashboard(previews: SeoDryRunPreview[]): DryRunBatchDashboard {
  const total = previews.length;
  let meeting = 0;
  let failUnique = 0;
  let failSeo = 0;
  let wouldSave = 0;
  let uSum = 0;
  let sSum = 0;
  let tSum = 0;

  for (const p of previews) {
    if (p.wouldSave) wouldSave++;
    if (p.meetsThreshold) meeting++;
    if (p.after.uniqueness < SEO_V61_CONFIG.minUniqueness) failUnique++;
    if (p.after.seo < SEO_V61_CONFIG.minSeo) failSeo++;
    uSum += p.after.uniqueness;
    sSum += p.after.seo;
    tSum += p.generationTimeMs;
  }

  return {
    totalPages: total,
    meetingThreshold: meeting,
    failingUniqueness: failUnique,
    failingSeo: failSeo,
    avgUniqueness: total > 0 ? Math.round(uSum / total) : null,
    avgSeo: total > 0 ? Math.round(sSum / total) : null,
    avgGenerationTimeMs: total > 0 ? Math.round(tSum / total) : null,
    wouldSaveCount: wouldSave,
  };
}

/** Memory-only batch dry run — zero DB mutations. */
export async function runDryRunBatch(input: {
  pages: Array<{ pageType: string; pageSlug: string }>;
  mode?: UniversalSeoMode;
  concurrency?: number;
  sessionId?: string;
}): Promise<{
  sessionId: string;
  dryRun: true;
  previewOnly: true;
  previews: SeoDryRunPreview[];
  dashboard: DryRunBatchDashboard;
  errors: Array<{ pageSlug: string; error: string }>;
}> {
  const sessionId = input.sessionId ?? randomUUID();
  const mode = input.mode ?? "regenerate";
  const concurrency = input.concurrency ?? 3;
  const previews: SeoDryRunPreview[] = [];
  const errors: Array<{ pageSlug: string; error: string }> = [];

  for (let i = 0; i < input.pages.length; i += concurrency) {
    // Yield to the event loop between chunks so polling GET requests can be served
    await new Promise((r) => setImmediate(r));
    const chunk = input.pages.slice(i, i + concurrency);
    const PAGE_TIMEOUT_MS = 90_000;
    const results = await Promise.all(
      chunk.map(async (p) => {
        const result = await Promise.race([
          buildSeoPagePreview({ pageType: p.pageType, pageSlug: p.pageSlug, mode }),
          new Promise<{ ok: false; error: string }>((resolve) =>
            setTimeout(
              () => resolve({ ok: false, error: "Page generation timed out (90s)" }),
              PAGE_TIMEOUT_MS,
            ),
          ),
        ]);
        return { pageSlug: p.pageSlug, result };
      }),
    );
    for (const { pageSlug, result } of results) {
      if ("previewId" in result) {
        result.sessionId = sessionId;
        previews.push(result);
      } else {
        errors.push({ pageSlug, error: result.error });
      }
    }
  }

  const dashboard = aggregateDashboard(previews);
  putDryRunSession(
    sessionId,
    previews.map((p) => p.previewId),
    dashboard,
  );

  return {
    sessionId,
    dryRun: true,
    previewOnly: true,
    previews,
    dashboard,
    errors,
  };
}

export type CommitMode = "all" | "selected" | "improved";

/** Commit cached previews to database. */
export async function commitDryRunPreviews(input: {
  previewIds: string[];
  mode?: CommitMode;
  runId?: string | null;
  createdBy?: { id: string; email: string };
}): Promise<{
  committed: number;
  skipped: number;
  failed: number;
  results: Array<{ previewId: string; pageSlug: string; ok: boolean; error?: string }>;
}> {
  let ids = input.previewIds;
  if (input.mode === "improved") {
    ids = ids.filter((id) => {
      const p = getDryRunPreview<SeoDryRunPreview>(id);
      return p?.wouldSave && (p.delta.uniqueness ?? 0) > 0;
    });
  }

  let committed = 0;
  let skipped = 0;
  let failed = 0;
  const results: Array<{ previewId: string; pageSlug: string; ok: boolean; error?: string }> = [];

  for (const previewId of ids) {
    const preview = getDryRunPreview<SeoDryRunPreview>(previewId);
    if (!preview) {
      failed++;
      results.push({ previewId, pageSlug: "?", ok: false, error: "Preview expired" });
      continue;
    }

    if (!preview.wouldSave) {
      skipped++;
      results.push({ previewId, pageSlug: preview.pageSlug, ok: false, error: "Below save threshold" });
      continue;
    }

    try {
      await commitSinglePreview(preview, input.runId ?? null, input.createdBy);
      committed++;
      results.push({ previewId, pageSlug: preview.pageSlug, ok: true });
    } catch (err) {
      failed++;
      results.push({
        previewId,
        pageSlug: preview.pageSlug,
        ok: false,
        error: err instanceof Error ? err.message : "Commit failed",
      });
    }
  }

  return { committed, skipped, failed, results };
}

async function commitSinglePreview(
  preview: SeoDryRunPreview,
  runId: string | null,
  createdBy?: { id: string; email: string },
) {
  if (!preview.seoPageId) {
    const introContent = resolveIntroContentForStorage(preview.content);
    const metrics = await computePageQualityMetrics(
      preview.pageType as SeoPageType,
      preview.pageSlug,
      preview.content,
      introContent,
      { canonicalUrl: preview.canonicalUrl },
    );
    await upsertFromContent(
      preview.pageType as SeoPageType,
      preview.pageSlug,
      preview.content,
      preview.canonicalUrl,
      { precomputedMetrics: metrics },
    );
    return;
  }

  const existing = await db.seoPage.findUnique({
    where: { id: preview.seoPageId },
    select: { id: true, featuredImage: true },
  });
  if (!existing) throw new Error("Page not found");

  const introContent = resolveIntroContentForStorage(preview.content);
  const metrics = await computePageQualityMetrics(
    preview.pageType as SeoPageType,
    preview.pageSlug,
    preview.content,
    introContent,
    {
      featuredImage: existing.featuredImage,
      canonicalUrl: preview.canonicalUrl,
      excludePageId: existing.id,
    },
  );

  await snapshotContentVersion(existing.id, runId, createdBy, { optimizationAction: "dry_run_commit" });

  const canonicalUrl = getServedPathForSeoPage({
    pageType: preview.pageType,
    pageSlug: preview.pageSlug,
    canonicalUrl: preview.canonicalUrl,
  });

  await upsertFromContent(
    preview.pageType as SeoPageType,
    preview.pageSlug,
    preview.content,
    canonicalUrl,
    {
      skipImage: true,
      existingFeaturedImage: existing.featuredImage,
      precomputedMetrics: metrics,
      excludePageId: existing.id,
    },
  );
}

export function getDryRunSessionPreviews(sessionId: string): SeoDryRunPreview[] {
  const session = getDryRunSession(sessionId);
  if (!session) return [];
  return session.previewIds
    .map((id) => getDryRunPreview<SeoDryRunPreview>(id))
    .filter((p): p is SeoDryRunPreview => p != null);
}

export function buildVirtualDryRunProgress(input: {
  sessionId: string;
  mode: string;
  dashboard: DryRunBatchDashboard;
  errorCount: number;
  createdByEmail?: string | null;
  elapsedMs?: number;
}) {
  const { sessionId, mode, dashboard, errorCount, createdByEmail, elapsedMs } = input;
  const completed = dashboard.totalPages - errorCount;
  return {
    id: sessionId,
    status: "dry_run_completed",
    mode,
    dryRun: true,
    confirmed: false,
    batchSize: dashboard.totalPages,
    totalPages: dashboard.totalPages,
    queued: 0,
    processing: 0,
    completed,
    failed: errorCount,
    skipped: 0,
    remaining: 0,
    avgUniqueness: dashboard.avgUniqueness,
    avgSeoScore: dashboard.avgSeo,
    lowRiskCount: 0,
    mediumRiskCount: 0,
    highRiskCount: 0,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    elapsedMs: elapsedMs ?? dashboard.avgGenerationTimeMs != null
      ? dashboard.avgGenerationTimeMs! * dashboard.totalPages
      : null,
    estimatedRemainingMs: null,
    createdByEmail: createdByEmail ?? null,
    errorMessage: null,
  };
}

export function previewToStudioItem(
  preview: SeoDryRunPreview,
  committed = false,
): {
  id: string;
  seoPageId: string | null;
  pageSlug: string;
  pageType: string;
  status: string;
  error: string | null;
  predictedWords: number | null;
  predictedUnique: number | null;
  predictedScore: number | null;
  predictedRisk: string | null;
  versionId: string | null;
  priorUnique: number | null;
  priorSeoScore: number | null;
  saved?: boolean;
  previewId?: string;
  processedAt: string | null;
  updatedAt: string;
  page: {
    title: string | null;
    wordCount: number | null;
    faqCount: number | null;
    internalLinksCount: number | null;
    uniquenessScore: number | null;
    seoQualityScore: number | null;
    duplicateRisk: string | null;
    hasMeta: boolean;
    hasImage: boolean;
    updatedAt: string;
  } | null;
} {
  const status = committed
    ? "saved"
    : preview.wouldSave
      ? "ready_to_commit"
      : "dry_run";
  const now = new Date().toISOString();
  return {
    id: preview.previewId,
    previewId: preview.previewId,
    seoPageId: preview.seoPageId,
    pageSlug: preview.pageSlug,
    pageType: preview.pageType,
    status,
    error: preview.wouldSave ? null : preview.saveReason,
    predictedWords: preview.after.wordCount,
    predictedUnique: preview.after.uniqueness,
    predictedScore: preview.after.seo,
    predictedRisk: preview.after.duplicateRisk,
    versionId: null,
    priorUnique: preview.before.uniqueness,
    priorSeoScore: preview.before.seo,
    saved: committed,
    processedAt: now,
    updatedAt: now,
    page: {
      title: preview.before.title,
      wordCount: preview.before.wordCount,
      faqCount: preview.before.faqs.length,
      internalLinksCount: preview.after.internalLinksCount,
      uniquenessScore: preview.before.uniqueness,
      seoQualityScore: preview.before.seo,
      duplicateRisk: preview.after.duplicateRisk,
      hasMeta: Boolean(preview.before.meta),
      hasImage: false,
      updatedAt: now,
    },
  };
}

export function formatDryRunPreviewResponse(preview: SeoDryRunPreview) {
  return {
    dryRun: true as const,
    previewOnly: true as const,
    wouldSave: preview.wouldSave,
    meetsThreshold: preview.meetsThreshold,
    saveReason: preview.saveReason,
    previewId: preview.previewId,
    pageType: preview.pageType,
    pageSlug: preview.pageSlug,
    before: { uniqueness: preview.before.uniqueness, seo: preview.before.seo },
    after: { uniqueness: preview.after.uniqueness, seo: preview.after.seo },
    delta: preview.delta,
    diff: preview.diff,
    metadata: preview.metadata,
    generationTimeMs: preview.generationTimeMs,
    cached: preview.cached ?? false,
  };
}
