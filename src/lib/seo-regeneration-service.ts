/**
 * Bulk SEO content regeneration — queue, dry-run, version history, rollback.
 */

import { db } from "@/lib/db";
import {
  resolveIntroContentForStorage,
  type SEOContent,
} from "@/lib/seo-content";
import {
  generateCitySEOContent,
  generateCategorySEOContent,
  generateCategoryCitySEOContent,
  generateStateSEOContent,
  generateCountrySEOContent,
  generateLongTailSEOContent,
} from "@/lib/seo-engine";
import {
  upsertFromContent,
  computePageQualityMetrics,
  persistSeoFaqs,
  upsertSeoPage,
  buildSchemaJson,
  type SeoPageType,
} from "@/lib/seo-page-service";
import { enrichSchemaWithFeaturedImage, resolveSeoImageUrl } from "@/lib/seo-images";
import { clearSeoPeerCache, getSeoPeerCacheStats } from "@/lib/seo-peer-cache";
import { SEO_MIN_WORD_COUNT } from "@/lib/seo-quality";

export type RegenerationMode =
  | "all"
  | "selected_cities"
  | "duplicate_risk"
  | "low_score"
  | "below_words";

export type RunStatus =
  | "pending"
  | "awaiting_confirmation"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "dry_run_completed";

export interface CreateRunInput {
  mode: RegenerationMode;
  dryRun?: boolean;
  confirmed?: boolean;
  batchSize?: number;
  pageTypeFilter?: string | null;
  citySlugs?: string[];
  lowScoreThreshold?: number;
  duplicateRisks?: string[];
  createdBy?: { id: string; email: string };
}

export interface RegenerationPrediction {
  wordCount: number;
  uniquenessScore: number;
  seoQualityScore: number;
  duplicateRisk: string;
  title: string;
  h1: string;
}

export interface RunProgress {
  id: string;
  status: string;
  mode: string;
  dryRun: boolean;
  confirmed: boolean;
  batchSize: number;
  totalPages: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  remaining: number;
  avgUniqueness: number | null;
  avgSeoScore: number | null;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  startedAt: string | null;
  completedAt: string | null;
  elapsedMs: number | null;
  createdByEmail: string | null;
  errorMessage: string | null;
}

const LOW_SCORE_DEFAULT = 70;

const cityContextCache = new Map<
  string,
  Awaited<ReturnType<typeof loadCityContext>>
>();

/** Release in-memory caches between regeneration batches. */
export function clearRegenerationCaches(): void {
  clearSeoPeerCache();
  cityContextCache.clear();
}

export function getRegenerationCacheStats() {
  return {
    cityContexts: cityContextCache.size,
    peers: getSeoPeerCacheStats(),
  };
}

function extractCitySlugFromPage(pageType: string, pageSlug: string): string | null {
  if (pageType === "city") return pageSlug;
  if (pageType === "category_city" || pageType === "longtail") {
    const slash = pageSlug.indexOf("/");
    return slash >= 0 ? pageSlug.slice(slash + 1) : null;
  }
  return null;
}

async function preloadCityContexts(slugs: string[]): Promise<void> {
  const missing = [...new Set(slugs.filter((slug) => slug && !cityContextCache.has(slug)))];
  if (missing.length === 0) return;

  const cities = await db.city.findMany({
    where: { slug: { in: missing }, isActive: true },
    select: {
      name: true,
      slug: true,
      areas: { where: { isActive: true }, select: { name: true }, take: 12 },
      state: {
        select: {
          name: true,
          slug: true,
          country: { select: { name: true, slug: true } },
        },
      },
    },
  });

  for (const city of cities) {
    cityContextCache.set(city.slug, city);
  }
}

async function getCityContext(slug: string) {
  if (cityContextCache.has(slug)) {
    return cityContextCache.get(slug) ?? null;
  }
  const city = await loadCityContext(slug);
  if (city) cityContextCache.set(slug, city);
  return city;
}

export async function resolvePagesForRegeneration(input: {
  mode: RegenerationMode;
  pageTypeFilter?: string | null;
  citySlugs?: string[];
  lowScoreThreshold?: number;
  duplicateRisks?: string[];
}): Promise<Array<{ id: string; pageType: string; pageSlug: string }>> {
  const pageType = input.pageTypeFilter?.trim() || undefined;
  const where: Record<string, unknown> = {};

  if (pageType) where.pageType = pageType;

  switch (input.mode) {
    case "selected_cities":
      where.pageType = "city";
      where.pageSlug = { in: input.citySlugs ?? [] };
      break;
    case "duplicate_risk":
      where.duplicateRisk = {
        in: input.duplicateRisks?.length
          ? input.duplicateRisks
          : ["high", "medium"],
      };
      break;
    case "low_score":
      where.OR = [
        { seoQualityScore: { lt: input.lowScoreThreshold ?? LOW_SCORE_DEFAULT } },
        { seoQualityScore: null },
      ];
      break;
    case "below_words":
      where.OR = [
        { wordCount: { lt: SEO_MIN_WORD_COUNT } },
        { wordCount: null },
      ];
      break;
    case "all":
    default:
      break;
  }

  return db.seoPage.findMany({
    where,
    select: { id: true, pageType: true, pageSlug: true },
    orderBy: [{ pageType: "asc" }, { pageSlug: "asc" }],
  });
}

async function loadCityContext(slug: string) {
  return db.city.findFirst({
    where: { slug },
    select: {
      name: true,
      slug: true,
      areas: { where: { isActive: true }, select: { name: true }, take: 12 },
      state: {
        select: {
          name: true,
          slug: true,
          country: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

export async function buildRegeneratedContent(
  pageType: string,
  pageSlug: string,
): Promise<{ content: SEOContent; canonicalUrl: string } | null> {
  const existing = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
  });

  if (pageType === "city") {
    const city = await getCityContext(pageSlug);
    if (!city?.state) return null;
    const content = generateCitySEOContent(
      city.name,
      city.slug,
      city.state.name,
      city.state.country?.name || "India",
      {
        stateSlug: city.state.slug,
        dbAreas: city.areas.map((a) => a.name),
      },
    );
    const canonicalUrl =
      existing?.canonicalUrl ??
      `/${city.state.country?.slug || "india"}/${city.state.slug}/${city.slug}`;
    return { content, canonicalUrl };
  }

  if (pageType === "category") {
    const cat = await db.category.findFirst({
      where: { slug: pageSlug },
      select: { name: true, slug: true, description: true },
    });
    if (!cat) return null;
    const content = generateCategorySEOContent(cat.name, cat.slug, cat.description ?? undefined);
    return { content, canonicalUrl: existing?.canonicalUrl ?? `/category/${cat.slug}` };
  }

  if (pageType === "category_city") {
    const slash = pageSlug.indexOf("/");
    const resolvedCat = slash >= 0 ? pageSlug.slice(0, slash) : pageSlug.split("-")[0];
    const resolvedCity = slash >= 0 ? pageSlug.slice(slash + 1) : pageSlug.split("-").slice(1).join("-");
    if (!resolvedCat || !resolvedCity) return null;

    const category = await db.category.findFirst({ where: { slug: resolvedCat } });
    const city = await getCityContext(resolvedCity);
    if (!category || !city?.state) return null;

    const content = generateCategoryCitySEOContent(
      category.name,
      category.slug,
      city.name,
      city.slug,
      city.state.name,
      city.state.slug,
      city.areas.map((a) => a.name),
    );
    return {
      content,
      canonicalUrl: existing?.canonicalUrl ?? `/${category.slug}/${city.slug}`,
    };
  }

  if (pageType === "state") {
    const state = await db.state.findFirst({
      where: { slug: pageSlug },
      select: { name: true, slug: true, country: { select: { name: true, slug: true } } },
    });
    if (!state) return null;
    const content = generateStateSEOContent(state.name, state.slug, state.country?.name || "India");
    return {
      content,
      canonicalUrl: existing?.canonicalUrl ?? `/${state.country?.slug || "india"}/${state.slug}`,
    };
  }

  if (pageType === "country") {
    const country = await db.country.findFirst({ where: { slug: pageSlug } });
    if (!country) return null;
    const content = generateCountrySEOContent(country.name, country.slug);
    return { content, canonicalUrl: existing?.canonicalUrl ?? `/${country.slug}` };
  }

  if (pageType === "longtail") {
    const slash = pageSlug.indexOf("/");
    const keywordSlug = slash >= 0 ? pageSlug.slice(0, slash) : pageSlug;
    const citySlug = slash >= 0 ? pageSlug.slice(slash + 1) : "";
    const city = await getCityContext(citySlug);
    if (!city) return null;
    const keyword = keywordSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const content = generateLongTailSEOContent(
      keyword,
      keywordSlug,
      city.name,
      city.slug,
      city.state?.name ?? "",
      city.state?.slug ?? "",
      city.areas.map((a) => a.name),
    );
    return {
      content,
      canonicalUrl: existing?.canonicalUrl ?? `/${keywordSlug}/${citySlug}`,
    };
  }

  return null;
}

export async function predictRegeneration(
  pageType: string,
  pageSlug: string,
  built?: { content: SEOContent; canonicalUrl: string } | null,
): Promise<RegenerationPrediction | null> {
  const resolved = built ?? (await buildRegeneratedContent(pageType, pageSlug));
  if (!resolved) return null;

  const introContent = resolveIntroContentForStorage(resolved.content);
  const existing = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
    select: { id: true, featuredImage: true },
  });

  const metrics = await computePageQualityMetrics(
    pageType as SeoPageType,
    pageSlug,
    resolved.content,
    introContent,
    {
      featuredImage: existing?.featuredImage,
      canonicalUrl: resolved.canonicalUrl,
      excludePageId: existing?.id,
    },
  );

  return {
    wordCount: metrics.wordCount,
    uniquenessScore: metrics.uniquenessScore,
    seoQualityScore: metrics.seoQualityScore,
    duplicateRisk: metrics.duplicateRisk,
    title: resolved.content.title,
    h1: resolved.content.h1,
  };
}

async function snapshotVersion(
  seoPageId: string,
  runId: string | null,
  createdBy?: { id: string; email: string },
) {
  const page = await db.seoPage.findUnique({
    where: { id: seoPageId },
    include: { faqs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!page) return null;

  return db.seoContentVersion.create({
    data: {
      runId,
      seoPageId: page.id,
      pageType: page.pageType,
      pageSlug: page.pageSlug,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1,
      introContent: page.introContent,
      faqsJson: JSON.stringify(
        page.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      ),
      wordCount: page.wordCount,
      uniquenessScore: page.uniquenessScore,
      seoQualityScore: page.seoQualityScore,
      duplicateRisk: page.duplicateRisk,
      createdById: createdBy?.id,
      createdByEmail: createdBy?.email,
    },
  });
}

async function applyRegeneration(
  pageType: string,
  pageSlug: string,
  dryRun: boolean,
  runId: string | null,
  createdBy?: { id: string; email: string },
): Promise<{ ok: boolean; skipped?: boolean; error?: string; prediction?: RegenerationPrediction; versionId?: string }> {
  const existing = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
    select: { id: true, featuredImage: true },
  });
  if (!existing) return { ok: false, error: "Page not found" };

  const built = await buildRegeneratedContent(pageType, pageSlug);
  if (!built) return { ok: false, error: "Could not build content" };

  const introContent = resolveIntroContentForStorage(built.content);
  const metrics = await computePageQualityMetrics(
    pageType as SeoPageType,
    pageSlug,
    built.content,
    introContent,
    {
      featuredImage: existing.featuredImage,
      canonicalUrl: built.canonicalUrl,
      excludePageId: existing.id,
    },
  );

  const prediction: RegenerationPrediction = {
    wordCount: metrics.wordCount,
    uniquenessScore: metrics.uniquenessScore,
    seoQualityScore: metrics.seoQualityScore,
    duplicateRisk: metrics.duplicateRisk,
    title: built.content.title,
    h1: built.content.h1,
  };

  if (dryRun) {
    return { ok: true, prediction };
  }

  const version = await snapshotVersion(existing.id, runId, createdBy);

  await upsertFromContent(
    pageType as SeoPageType,
    pageSlug,
    built.content,
    built.canonicalUrl,
    {
      skipImage: true,
      existingFeaturedImage: existing.featuredImage,
      precomputedMetrics: metrics,
      excludePageId: existing.id,
    },
  );

  return { ok: true, prediction, versionId: version?.id };
}

export async function createRegenerationRun(input: CreateRunInput) {
  const dryRun = input.dryRun ?? false;
  const confirmed = input.confirmed ?? false;
  const batchSize = [10, 25, 50, 100].includes(input.batchSize ?? 25)
    ? (input.batchSize as number)
    : 25;

  const pages = await resolvePagesForRegeneration(input);

  if (!dryRun && !confirmed) {
    const run = await db.seoRegenerationRun.create({
      data: {
        status: "awaiting_confirmation",
        mode: input.mode,
        dryRun: false,
        confirmed: false,
        batchSize,
        pageTypeFilter: input.pageTypeFilter ?? null,
        filtersJson: JSON.stringify({
          citySlugs: input.citySlugs,
          lowScoreThreshold: input.lowScoreThreshold,
          duplicateRisks: input.duplicateRisks,
        }),
        totalPages: pages.length,
        queuedCount: pages.length,
        createdById: input.createdBy?.id,
        createdByEmail: input.createdBy?.email,
      },
    });

    if (pages.length > 0) {
      await db.seoRegenerationItem.createMany({
        data: pages.map((p) => ({
          runId: run.id,
          seoPageId: p.id,
          pageType: p.pageType,
          pageSlug: p.pageSlug,
          status: "queued",
        })),
      });
    }

    return { run, requiresConfirmation: true };
  }

  const run = await db.seoRegenerationRun.create({
    data: {
      status: "queued",
      mode: input.mode,
      dryRun,
      confirmed: dryRun ? false : confirmed,
      batchSize,
      pageTypeFilter: input.pageTypeFilter ?? null,
      filtersJson: JSON.stringify({
        citySlugs: input.citySlugs,
        lowScoreThreshold: input.lowScoreThreshold,
        duplicateRisks: input.duplicateRisks,
      }),
      totalPages: pages.length,
      queuedCount: pages.length,
      createdById: input.createdBy?.id,
      createdByEmail: input.createdBy?.email,
      startedAt: new Date(),
    },
  });

  if (pages.length > 0) {
    await db.seoRegenerationItem.createMany({
      data: pages.map((p) => ({
        runId: run.id,
        seoPageId: p.id,
        pageType: p.pageType,
        pageSlug: p.pageSlug,
        status: "queued",
      })),
    });
  }

  return { run, requiresConfirmation: false };
}

export async function confirmRegenerationRun(runId: string) {
  const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  if (run.dryRun) throw new Error("Dry run cannot be confirmed for write");
  if (run.status !== "awaiting_confirmation") throw new Error("Run is not awaiting confirmation");

  return db.seoRegenerationRun.update({
    where: { id: runId },
    data: {
      confirmed: true,
      status: "queued",
      startedAt: new Date(),
    },
  });
}

export async function processRegenerationBatch(runId: string, batchSize?: number) {
  const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  if (run.status === "cancelled" || run.status === "completed" || run.status === "dry_run_completed") {
    return { processed: 0, done: true };
  }
  if (!run.dryRun && !run.confirmed) {
    throw new Error("Run requires confirmation before processing writes");
  }

  const limit = batchSize ?? run.batchSize;
  const items = await db.seoRegenerationItem.findMany({
    where: { runId, status: "queued" },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  if (items.length === 0) {
    await finalizeRun(runId);
    return { processed: 0, done: true };
  }

  await db.seoRegenerationRun.update({
    where: { id: runId },
    data: { status: "processing", lastProcessedAt: new Date() },
  });

  const citySlugs = items
    .map((item) => extractCitySlugFromPage(item.pageType, item.pageSlug))
    .filter(Boolean) as string[];
  await preloadCityContexts(citySlugs);

  let processed = 0;
  const createdBy = run.createdById
    ? { id: run.createdById, email: run.createdByEmail ?? "" }
    : undefined;

  try {
    for (const item of items) {
    await db.seoRegenerationItem.update({
      where: { id: item.id },
      data: { status: "processing" },
    });

    try {
      const result = await applyRegeneration(
        item.pageType,
        item.pageSlug,
        run.dryRun,
        run.dryRun ? null : runId,
        createdBy,
      );

      if (!result.ok) {
        await db.seoRegenerationItem.update({
          where: { id: item.id },
          data: { status: "failed", error: result.error ?? "Unknown error", processedAt: new Date() },
        });
        await db.seoRegenerationRun.update({
          where: { id: runId },
          data: { failedCount: { increment: 1 }, queuedCount: { decrement: 1 } },
        });
        continue;
      }

      await db.seoRegenerationItem.update({
        where: { id: item.id },
        data: {
          status: "completed",
          predictedWords: result.prediction?.wordCount,
          predictedUnique: result.prediction?.uniquenessScore,
          predictedScore: result.prediction?.seoQualityScore,
          predictedRisk: result.prediction?.duplicateRisk,
          versionId: result.versionId ?? null,
          processedAt: new Date(),
        },
      });

      await db.seoRegenerationRun.update({
        where: { id: runId },
        data: {
          completedCount: { increment: 1 },
          queuedCount: { decrement: 1 },
        },
      });
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing error";
      await db.seoRegenerationItem.update({
        where: { id: item.id },
        data: { status: "failed", error: msg, processedAt: new Date() },
      });
      await db.seoRegenerationRun.update({
        where: { id: runId },
        data: { failedCount: { increment: 1 }, queuedCount: { decrement: 1 } },
      });
    }
    }
  } finally {
    clearRegenerationCaches();
  }

  const remaining = await db.seoRegenerationItem.count({ where: { runId, status: "queued" } });
  if (remaining === 0) {
    await finalizeRun(runId);
    return { processed, done: true, remaining: 0 };
  }

  await db.seoRegenerationRun.update({
    where: { id: runId },
    data: { status: "queued" },
  });

  return { processed, done: false, remaining };
}

async function finalizeRun(runId: string) {
  const items = await db.seoRegenerationItem.findMany({
    where: { runId, status: "completed" },
    select: {
      predictedWords: true,
      predictedUnique: true,
      predictedScore: true,
      predictedRisk: true,
    },
  });

  const avgUniqueness =
    items.length > 0
      ? items.reduce((s, i) => s + (i.predictedUnique ?? 0), 0) / items.length
      : null;
  const avgSeoScore =
    items.length > 0
      ? items.reduce((s, i) => s + (i.predictedScore ?? 0), 0) / items.length
      : null;

  const lowRiskCount = items.filter((i) => i.predictedRisk === "low").length;
  const mediumRiskCount = items.filter((i) => i.predictedRisk === "medium").length;
  const highRiskCount = items.filter((i) => i.predictedRisk === "high").length;

  const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
  const report = {
    pagesUpdated: items.length,
    pagesSkipped: run?.skippedCount ?? 0,
    failures: run?.failedCount ?? 0,
    averageUniqueness: avgUniqueness,
    averageSeoScore: avgSeoScore,
    lowRiskCount,
    mediumRiskCount,
    highRiskCount,
  };

  await db.seoRegenerationRun.update({
    where: { id: runId },
    data: {
      status: run?.dryRun ? "dry_run_completed" : "completed",
      completedAt: new Date(),
      avgUniqueness,
      avgSeoScore,
      lowRiskCount,
      mediumRiskCount,
      highRiskCount,
      reportJson: JSON.stringify(report),
    },
  });
}

export async function processRunUntilDone(runId: string, maxBatches = 500) {
  let batches = 0;
  let totalProcessed = 0;
  try {
    while (batches < maxBatches) {
      const result = await processRegenerationBatch(runId);
      totalProcessed += result.processed;
      if (result.done) break;
      batches++;
    }
  } finally {
    clearRegenerationCaches();
  }
  return { totalProcessed, batches };
}

export function serializeRunProgress(run: {
  id: string;
  status: string;
  mode: string;
  dryRun: boolean;
  confirmed: boolean;
  batchSize: number;
  totalPages: number;
  queuedCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  avgUniqueness: number | null;
  avgSeoScore: number | null;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdByEmail: string | null;
  errorMessage: string | null;
}): RunProgress {
  const remaining = run.queuedCount;
  const elapsedMs =
    run.startedAt != null
      ? (run.completedAt ?? new Date()).getTime() - run.startedAt.getTime()
      : null;

  return {
    id: run.id,
    status: run.status,
    mode: run.mode,
    dryRun: run.dryRun,
    confirmed: run.confirmed,
    batchSize: run.batchSize,
    totalPages: run.totalPages,
    queued: run.queuedCount,
    processing: run.processingCount,
    completed: run.completedCount,
    failed: run.failedCount,
    skipped: run.skippedCount,
    remaining,
    avgUniqueness: run.avgUniqueness,
    avgSeoScore: run.avgSeoScore,
    lowRiskCount: run.lowRiskCount,
    mediumRiskCount: run.mediumRiskCount,
    highRiskCount: run.highRiskCount,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    elapsedMs,
    createdByEmail: run.createdByEmail,
    errorMessage: run.errorMessage,
  };
}

export async function rollbackContentVersion(versionId: string) {
  const version = await db.seoContentVersion.findUnique({
    where: { id: versionId },
    include: { seoPage: true },
  });
  if (!version || version.rolledBackAt) throw new Error("Version not found or already rolled back");

  const faqs: Array<{ question: string; answer: string }> = version.faqsJson
    ? JSON.parse(version.faqsJson)
    : [];

  const page = version.seoPage;

  await upsertSeoPage({
    pageType: page.pageType as SeoPageType,
    pageSlug: page.pageSlug,
    title: version.title ?? "",
    metaDescription: version.metaDescription ?? "",
    h1: version.h1 ?? "",
    introContent: version.introContent ?? "",
    canonicalUrl: page.canonicalUrl ?? "",
    customData: page.customData,
    featuredImage: page.featuredImage,
    imageAlt: page.imageAlt,
    imageTitle: page.imageTitle,
    imageCaption: page.imageCaption,
    isPublished: page.isPublished,
    noindex: page.noindex,
    wordCount: version.wordCount,
    uniquenessScore: version.uniquenessScore,
    duplicateRisk: version.duplicateRisk,
    seoQualityScore: version.seoQualityScore,
    contentHash: page.contentHash,
    faqCount: faqs.length,
    internalLinksCount: page.internalLinksCount,
  });

  await persistSeoFaqs(page.id, faqs);

  await db.seoContentVersion.update({
    where: { id: versionId },
    data: { rolledBackAt: new Date() },
  });

  return { success: true, pageSlug: page.pageSlug };
}

export async function rollbackRegenerationRun(runId: string) {
  const versions = await db.seoContentVersion.findMany({
    where: { runId, rolledBackAt: null },
    orderBy: { createdAt: "desc" },
  });

  let rolledBack = 0;
  const seen = new Set<string>();

  for (const version of versions) {
    if (seen.has(version.seoPageId)) continue;
    seen.add(version.seoPageId);
    await rollbackContentVersion(version.id);
    rolledBack++;
  }

  return { rolledBack, total: versions.length };
}

export async function cancelRegenerationRun(runId: string) {
  return db.seoRegenerationRun.update({
    where: { id: runId },
    data: { status: "cancelled", completedAt: new Date() },
  });
}

export async function resumeRegenerationRun(runId: string) {
  const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  if (!run.dryRun && !run.confirmed) throw new Error("Run not confirmed");

  const queued = await db.seoRegenerationItem.count({ where: { runId, status: "queued" } });
  if (queued === 0) {
    await finalizeRun(runId);
    return { resumed: false, message: "No queued items", totalProcessed: 0 };
  }

  await db.seoRegenerationRun.update({
    where: { id: runId },
    data: { status: "queued", startedAt: run.startedAt ?? new Date() },
  });

  return processRunUntilDone(runId);
}
