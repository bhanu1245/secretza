/**
 * Bulk SEO content regeneration — queue, dry-run, version history, rollback.
 */

import { db } from "@/lib/db";
import { scheduleSeoBackgroundWork } from "@/lib/seo-background-scheduler";
import {
  checkRegenInvariant,
  clampRunProgressFields,
  deriveRunCounters,
  emptyRegenStatusCounts,
  type RegenStatusCounts,
} from "@/lib/seo-regeneration-counters";
import {
  resolveIntroContentForStorage,
  type SEOContent,
} from "@/lib/seo-content";
import { getActiveSeoEngine } from "@/lib/seo-engine";
import {
  generateUniversalSeoContent,
  buildUniversalGenerationMeta,
} from "@/lib/seo-universal-engine";
import { clearParagraphFingerprintCache } from "@/lib/seo-paragraph-fingerprints";
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
import {
  buildLinkContextFromPage,
  sanitizeSeoContentLinks,
} from "@/lib/seo-internal-links";
import {
  getServedPathForSeoPage,
  isSeoPageRoutable,
  listUnroutableSeoPageIds,
} from "@/lib/seo-route-validation";
import { slugify } from "@/lib/slugify";
import {
  completeItemProgress,
  initItemProgress,
  setItemStage,
  clearItemProgress,
  clearAllItemProgress,
} from "@/lib/seo-regen-progress";
import { pickSavePolicy } from "@/lib/seo-regen-save-policy";
import {
  persistItemGenerationMeta,
  serializeGenerationMeta,
  type SeoGenerationMeta,
} from "@/lib/seo-generation-metadata";
import { safeRegenerationItemUpdateMany } from "@/lib/seo-regeneration-queries";

export type RegenerationMode =
  | "all"
  | "selected_cities"
  | "selected_pages"
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
  pageIds?: string[];
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
  priorUniqueness?: number | null;
  priorSeoScore?: number | null;
  saved?: boolean;
  discarded?: boolean;
  savedAt?: string;
  saveReason?: string;
  generationMeta?: Record<string, unknown>;
  requiresReview?: boolean;
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

/**
 * Memoized disambiguated display names. Multiple active City rows can share the
 * same name (e.g. two "Akola" rows in Maharashtra with slugs `akola` and
 * `akola-mah`). Because every SEO title/H1/meta template is keyed on the city
 * NAME (not the slug), such rows would otherwise regenerate to byte-identical
 * output forever. This cache holds a slug-stable, unique display name per city.
 */
const cityDisplayNameCache = new Map<string, string>();

/** Release in-memory caches between regeneration batches. */
export function clearRegenerationCaches(): void {
  clearSeoPeerCache();
  clearParagraphFingerprintCache();
  cityContextCache.clear();
  cityDisplayNameCache.clear();
}

type ResolvedCity = NonNullable<Awaited<ReturnType<typeof loadCityContext>>>;

/**
 * Returns a unique, deterministic display name for a city. If no other active
 * city shares this name, the plain name is returned (no regression for the
 * canonical page). Otherwise:
 *  - same name in a DIFFERENT state  → "Name, State"
 *  - same name in the SAME state     → "Name (Qualifier)" derived from the slug
 * The canonical row (slug === slugify(name)) always keeps its plain name so the
 * primary page is never altered.
 */
async function resolveCityDisplayName(city: ResolvedCity): Promise<string> {
  const cached = cityDisplayNameCache.get(city.slug);
  if (cached !== undefined) return cached;

  const siblings = await db.city.findMany({
    where: { name: city.name, isActive: true, slug: { not: city.slug } },
    select: { slug: true, state: { select: { name: true } } },
  });

  let display = city.name;

  if (siblings.length > 0) {
    const nameSlug = slugify(city.name);
    const isCanonical = city.slug === nameSlug;
    const thisState = city.state?.name ?? "";
    const hasSameStateSibling = siblings.some(
      (s) => (s.state?.name ?? "") === thisState,
    );

    if (!isCanonical) {
      if (hasSameStateSibling) {
        const remainder = city.slug.startsWith(`${nameSlug}-`)
          ? city.slug.slice(nameSlug.length + 1)
          : city.slug;
        const qualifier = remainder
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim();
        display = qualifier ? `${city.name} (${qualifier})` : city.name;
      } else if (thisState) {
        display = `${city.name}, ${thisState}`;
      }
    }
  }

  cityDisplayNameCache.set(city.slug, display);
  return display;
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
  pageIds?: string[];
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
    case "selected_pages":
      where.id = { in: input.pageIds ?? [] };
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

  const unroutable = await listUnroutableSeoPageIds();
  const resolved = await db.seoPage.findMany({
    where: {
      ...where,
      ...(unroutable.size > 0 ? { id: { notIn: [...unroutable] } } : {}),
    },
    select: { id: true, pageType: true, pageSlug: true },
    orderBy: [{ pageType: "asc" }, { pageSlug: "asc" }],
  });
  if (process.env.SEO_DEBUG === "true") {
    console.log("PAGES_RESOLVED", {
      mode: input.mode,
      count: resolved.length,
      skippedUnroutable: unroutable.size,
      ids: resolved.map((p) => p.id),
    });
  }
  return resolved;
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
  options?: { ignoreExistingCanonical?: boolean },
): Promise<{ content: SEOContent; canonicalUrl: string } | null> {
  try {
    const result = await generateUniversalSeoContent({
      pageType: pageType as SeoPageType,
      pageSlug,
      mode: "regenerate",
      ignoreExistingCanonical: options?.ignoreExistingCanonical,
    });
    if (!result.canonicalUrl) return null;
    return { content: result.content, canonicalUrl: result.canonicalUrl };
  } catch {
    return null;
  }
}

/** Regenerate a single SEO page by database id (used by universal Auto Fix). */
export async function regenerateSeoPageById(
  pageId: string,
  createdBy?: { id: string; email: string },
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const page = await db.seoPage.findUnique({
    where: { id: pageId },
    select: { pageType: true, pageSlug: true },
  });
  if (!page) return { ok: false, error: "Page not found" };
  return applyRegeneration(page.pageType, page.pageSlug, false, null, createdBy);
}

export async function predictRegeneration(
  pageType: string,
  pageSlug: string,
  built?: { content: SEOContent; canonicalUrl: string } | null,
): Promise<RegenerationPrediction | null> {
  const resolved = built ?? (await buildRegeneratedContent(pageType, pageSlug));
  if (!resolved) return null;

  const linkContext = buildLinkContextFromPage(pageType, pageSlug);
  resolved.content = await sanitizeSeoContentLinks(resolved.content, linkContext);

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

export async function snapshotContentVersion(
  seoPageId: string,
  runId: string | null,
  createdBy?: { id: string; email: string },
  meta?: { optimizationAction?: string },
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
      createdByEmail: meta?.optimizationAction
        ? `${createdBy?.email ?? "system"} · ${meta.optimizationAction}`
        : createdBy?.email,
    },
  });
}

async function applyRegeneration(
  pageType: string,
  pageSlug: string,
  dryRun: boolean,
  runId: string | null,
  createdBy?: { id: string; email: string },
  options?: { itemId?: string; optimizationAction?: string },
): Promise<{
  ok: boolean;
  skipped?: boolean;
  discarded?: boolean;
  failed?: boolean;
  error?: string;
  prediction?: RegenerationPrediction;
  versionId?: string;
}> {
  const existing = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
    select: {
      id: true,
      featuredImage: true,
      canonicalUrl: true,
      uniquenessScore: true,
      seoQualityScore: true,
    },
  });
  if (!existing) return { ok: false, error: "Page not found" };

  const priorUniqueness = existing.uniquenessScore;
  const priorSeoScore = existing.seoQualityScore;

  const routeCheck = await isSeoPageRoutable({
    pageType,
    pageSlug,
    canonicalUrl: existing.canonicalUrl,
  });
  if (!routeCheck.routable) {
    console.log("REGEN_SKIP_UNROUTABLE", {
      pageType,
      pageSlug,
      reason: routeCheck.reason,
      publicPath: routeCheck.publicPath,
    });
    return { ok: true, skipped: true, error: routeCheck.reason };
  }

  const itemId = options?.itemId;
  const regenStart = Date.now();
  if (itemId) initItemProgress(itemId);

  const stage = (id: Parameters<typeof setItemStage>[1], running = true) => {
    if (itemId) setItemStage(itemId, id, running ? "running" : "complete");
  };

  stage("generating_intro");
  const built = await buildRegeneratedContent(pageType, pageSlug);
  if (!built) return { ok: false, error: "Could not build content" };
  stage("generating_intro", false);
  stage("generating_faqs");
  stage("generating_faqs", false);
  stage("rewriting_duplicates");
  stage("rewriting_duplicates", false);
  stage("optimizing_keywords");
  stage("optimizing_keywords", false);
  stage("rewriting_faqs");
  stage("rewriting_faqs", false);
  stage("rewriting_cta");
  stage("rewriting_cta", false);

  const linkContext = buildLinkContextFromPage(pageType, pageSlug);
  built.content = await sanitizeSeoContentLinks(built.content, linkContext);

  stage("calculating_scores");
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

  stage("calculating_scores", false);
  stage("evaluating_improvement");

  const evaluateSave = pickSavePolicy(getActiveSeoEngine());
  const saveDecision = evaluateSave({
    priorUniqueness,
    priorSeoScore,
    newUniqueness: metrics.uniquenessScore,
    newSeoScore: metrics.seoQualityScore,
    attemptsExhausted: true,
  });

  const generationMeta = buildUniversalGenerationMeta({
    mode: "regenerate",
    priorUniqueness,
    priorSeoScore,
    newUniqueness: metrics.uniquenessScore,
    newSeoScore: metrics.seoQualityScore,
    rawMeta: built.content.generationMeta ?? {},
    generationTimeMs: Number(built.content.generationMeta?.generationTimeMs ?? Date.now() - regenStart),
    requiresManualReview: saveDecision.requiresReview,
    failureReason: saveDecision.requiresReview ? saveDecision.reason : undefined,
  });
  generationMeta.saveQuality = saveDecision.saveQuality;

  const prediction: RegenerationPrediction = {
    wordCount: metrics.wordCount,
    uniquenessScore: metrics.uniquenessScore,
    seoQualityScore: metrics.seoQualityScore,
    duplicateRisk: metrics.duplicateRisk,
    title: built.content.title,
    h1: built.content.h1,
    priorUniqueness,
    priorSeoScore,
    saved: false,
    discarded: false,
    saveReason: saveDecision.reason,
    generationMeta: generationMeta as unknown as Record<string, unknown>,
    requiresReview: saveDecision.requiresReview,
  };

  if (itemId) {
    await persistItemGenerationMeta(itemId, generationMeta);
  }

  stage("evaluating_improvement", false);

  if (dryRun) {
    if (itemId) completeItemProgress(itemId, false);
    return { ok: true, prediction: { ...prediction, saved: saveDecision.save } };
  }

  if (!saveDecision.save) {
    if (itemId) {
      setItemStage(itemId, "saving", "skipped");
      completeItemProgress(itemId, false);
    }
    if (saveDecision.failed) {
      return {
        ok: false,
        failed: true,
        error: saveDecision.reason,
        prediction: { ...prediction, requiresReview: true, saveReason: saveDecision.reason },
      };
    }
    return {
      ok: true,
      skipped: true,
      discarded: true,
      prediction: { ...prediction, discarded: true, saveReason: saveDecision.reason },
    };
  }

  stage("saving");
  const version = await snapshotContentVersion(
    existing.id,
    runId,
    createdBy,
    { optimizationAction: options?.optimizationAction ?? "regeneration" },
  );

  const canonicalUrl = getServedPathForSeoPage({
    pageType,
    pageSlug,
    canonicalUrl: built.canonicalUrl,
  });

  await upsertFromContent(
    pageType as SeoPageType,
    pageSlug,
    built.content,
    canonicalUrl,
    {
      skipImage: true,
      existingFeaturedImage: existing.featuredImage,
      precomputedMetrics: metrics,
      excludePageId: existing.id,
    },
  );

  stage("saving", false);
  const savedAt = new Date().toISOString();
  if (itemId) completeItemProgress(itemId, true);

  return {
    ok: true,
    prediction: {
      ...prediction,
      saved: true,
      savedAt,
      saveReason: saveDecision.reason,
    },
    versionId: version?.id,
  };
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

const cancelledRegenerationRuns = new Set<string>();
const runningRegenerationRuns = new Set<string>();
const batchLockQueues = new Map<string, Promise<void>>();

const STALE_PROCESSING_MS = 3 * 60 * 1000;
const REGEN_ITEM_CONCURRENCY = 3;

function isRegenerationRunTerminal(status: string) {
  return status === "cancelled" || status === "completed" || status === "dry_run_completed";
}

async function isRegenerationRunCancelled(runId: string) {
  if (cancelledRegenerationRuns.has(runId)) return true;
  const run = await db.seoRegenerationRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  return !run || isRegenerationRunTerminal(run.status);
}

async function withRegenerationBatchLock<T>(
  runId: string,
  fn: () => Promise<T>,
): Promise<T | { processed: 0; done: false; busy: true }> {
  const prev = batchLockQueues.get(runId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  batchLockQueues.set(runId, prev.then(() => gate));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (batchLockQueues.get(runId) === gate) {
      batchLockQueues.delete(runId);
    }
  }
}

export async function loadRegenerationStatusCounts(runId: string): Promise<RegenStatusCounts> {
  const groups = await db.seoRegenerationItem.groupBy({
    by: ["status"],
    where: { runId },
    _count: { id: true },
  });
  const counts = emptyRegenStatusCounts();
  for (const g of groups) {
    const key = g.status as keyof RegenStatusCounts;
    if (key in counts) counts[key] = g._count.id;
  }
  return counts;
}

/** Recompute run counters from item statuses — never blind increment/decrement. */
export async function recomputeRunCounters(runId: string) {
  const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
  if (!run) return null;

  const counts = await loadRegenerationStatusCounts(runId);
  const invariant = checkRegenInvariant(run.totalPages, counts);
  if (!invariant.ok) {
    console.warn("SEO_REGEN_INVARIANT_DRIFT", {
      runId,
      totalPages: run.totalPages,
      counts,
      message: invariant.message,
    });
  }

  const derived = deriveRunCounters(run.totalPages, counts);
  await db.seoRegenerationRun.update({
    where: { id: runId },
    data: {
      queuedCount: derived.queuedCount,
      processingCount: derived.processingCount,
      completedCount: derived.completedCount,
      failedCount: derived.failedCount,
      skippedCount: derived.skippedCount,
    },
  });

  return { counts, derived, invariant };
}

/** Mark long-stuck processing items as failed — never requeue (prevents double processing). */
export async function failStaleRegenerationItems(runId: string) {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  const reset = await db.seoRegenerationItem.updateMany({
    where: {
      runId,
      status: "processing",
      updatedAt: { lt: cutoff },
    },
    data: {
      status: "failed",
      error: "Stale processing timeout",
      processedAt: new Date(),
    },
  });
  if (reset.count > 0) {
    console.log("SEO_REGEN_FAIL_STALE", { runId, count: reset.count });
    await recomputeRunCounters(runId);
  }
  return reset.count;
}

/** @deprecated Use failStaleRegenerationItems — requeue caused double-counting. */
export async function resetOrphanedRegenerationItems(runId: string) {
  return failStaleRegenerationItems(runId);
}

/** Atomically claim queued items — only status=queued → processing. */
export async function claimQueuedRegenerationItems(runId: string, limit: number) {
  return db.$transaction(async (tx) => {
    const run = await tx.seoRegenerationRun.findUnique({
      where: { id: runId },
      select: { status: true, dryRun: true, confirmed: true },
    });
    if (!run || isRegenerationRunTerminal(run.status)) return [];
    if (!run.dryRun && !run.confirmed) return [];

    const candidates = await tx.seoRegenerationItem.findMany({
      where: { runId, status: "queued" },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    const claimed: typeof candidates = [];
    for (const item of candidates) {
      const updated = await tx.seoRegenerationItem.updateMany({
        where: { id: item.id, status: "queued" },
        data: { status: "processing", processedAt: null, error: null },
      });
      if (updated.count === 1) claimed.push(item);
    }
    return claimed;
  });
}

async function markRegenerationItemOutcome(
  itemId: string,
  outcome: "completed" | "failed" | "skipped",
  data: Record<string, unknown>,
) {
  const result = await safeRegenerationItemUpdateMany({
    where: { id: itemId, status: "processing" },
    data: { status: outcome, processedAt: new Date(), ...data },
  });
  clearItemProgress(itemId);
  return result;
}

/** Re-queue selected items in an existing run for regeneration. */
export async function requeueRegenerationItems(runId: string, itemIds: string[]) {
  if (itemIds.length === 0) return { requeued: 0 };

  const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  if (!run.dryRun && !run.confirmed) throw new Error("Run requires confirmation before live writes");

  const updated = await db.seoRegenerationItem.updateMany({
    where: { runId, id: { in: itemIds } },
    data: {
      status: "queued",
      error: null,
      processedAt: null,
      predictedWords: null,
      predictedUnique: null,
      predictedScore: null,
      predictedRisk: null,
      versionId: null,
    },
  });

  await db.seoRegenerationRun.update({
    where: { id: runId },
    data: {
      status: "processing",
      startedAt: run.startedAt ?? new Date(),
      completedAt: null,
    },
  });

  await recomputeRunCounters(runId);
  kickOffRegenerationProcessing(runId);

  return { requeued: updated.count };
}

export async function processRegenerationBatch(runId: string, batchSize?: number) {
  return withRegenerationBatchLock(runId, async () => {
    if (await isRegenerationRunCancelled(runId)) {
      return { processed: 0, done: true, cancelled: true };
    }

    const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error("Run not found");
    if (isRegenerationRunTerminal(run.status)) {
      return { processed: 0, done: true };
    }
    if (!run.dryRun && !run.confirmed) {
      throw new Error("Run requires confirmation before processing writes");
    }

    await failStaleRegenerationItems(runId);

    if (await isRegenerationRunCancelled(runId)) {
      return { processed: 0, done: true, cancelled: true };
    }

    const limit = batchSize ?? run.batchSize;
    console.log("SEO_REGEN_BATCH_START", { runId, limit, status: run.status });

    const items = await claimQueuedRegenerationItems(runId, limit);
    await recomputeRunCounters(runId);

    if (items.length === 0) {
      const queued = await db.seoRegenerationItem.count({
        where: { runId, status: "queued" },
      });
      if (queued === 0) {
        await finalizeRun(runId);
        return { processed: 0, done: true, remaining: 0 };
      }
      return { processed: 0, done: false, remaining: queued, busy: true };
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

    const processOneItem = async (item: (typeof items)[0]): Promise<number> => {
      if (await isRegenerationRunCancelled(runId)) return 0;

      try {
        const result = await applyRegeneration(
          item.pageType,
          item.pageSlug,
          run.dryRun,
          run.dryRun ? null : runId,
          createdBy,
          { itemId: item.id, optimizationAction: "regeneration" },
        );

        const metaJson = result.prediction?.generationMeta
          ? JSON.stringify(result.prediction.generationMeta)
          : undefined;

        if (!result.ok) {
          const wrote = await markRegenerationItemOutcome(item.id, "failed", {
            error: result.error ?? "Unknown error",
            predictedWords: result.prediction?.wordCount,
            predictedUnique: result.prediction?.uniquenessScore,
            predictedScore: result.prediction?.seoQualityScore,
            predictedRisk: result.prediction?.duplicateRisk,
            generationMetaJson: metaJson,
          });
          return wrote.count === 1 ? 1 : 0;
        }

        if (result.discarded || result.skipped) {
          const wrote = await markRegenerationItemOutcome(item.id, "skipped", {
            predictedWords: result.prediction?.wordCount,
            predictedUnique: result.prediction?.uniquenessScore,
            predictedScore: result.prediction?.seoQualityScore,
            predictedRisk: result.prediction?.duplicateRisk,
            error: result.prediction?.saveReason ?? "Not saved — no improvement",
            generationMetaJson: metaJson,
          });
          return wrote.count === 1 ? 1 : 0;
        }

        const wrote = await markRegenerationItemOutcome(item.id, "completed", {
          predictedWords: result.prediction?.wordCount,
          predictedUnique: result.prediction?.uniquenessScore,
          predictedScore: result.prediction?.seoQualityScore,
          predictedRisk: result.prediction?.duplicateRisk,
          versionId: result.versionId ?? null,
          error: result.prediction?.saved ? "saved" : null,
          generationMetaJson: metaJson,
        });
        return wrote.count === 1 ? 1 : 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Processing error";
        await markRegenerationItemOutcome(item.id, "failed", { error: msg });
        return 0;
      }
    };

    try {
      for (let i = 0; i < items.length; i += REGEN_ITEM_CONCURRENCY) {
        if (await isRegenerationRunCancelled(runId)) break;
        const chunk = items.slice(i, i + REGEN_ITEM_CONCURRENCY);
        const counts = await Promise.all(chunk.map((item) => processOneItem(item)));
        processed += counts.reduce((a, b) => a + b, 0);
      }
    } finally {
      clearRegenerationCaches();
      clearAllItemProgress();
      await recomputeRunCounters(runId);
    }

    if (await isRegenerationRunCancelled(runId)) {
      return { processed, done: true, cancelled: true };
    }

    const counts = await loadRegenerationStatusCounts(runId);
    const remaining = counts.queued + counts.processing;

    if (remaining === 0) {
      await finalizeRun(runId);
      return { processed, done: true, remaining: 0 };
    }

    await db.seoRegenerationRun.update({
      where: { id: runId },
      data: { status: "queued" },
    });

    return { processed, done: false, remaining };
  });
}

async function finalizeRun(runId: string) {
  const pending = await loadRegenerationStatusCounts(runId);
  if (pending.queued > 0 || pending.processing > 0) {
    console.warn("SEO_REGEN_FINALIZE_BLOCKED", { runId, pending });
    return;
  }

  const allItems = await db.seoRegenerationItem.findMany({
    where: { runId },
    select: {
      status: true,
      pageSlug: true,
      predictedWords: true,
      predictedUnique: true,
      predictedScore: true,
      predictedRisk: true,
      versionId: true,
    },
  });

  const completed = allItems.filter((i) => i.status === "completed");
  const versionIds = completed.map((i) => i.versionId).filter((id): id is string => Boolean(id));
  const versions =
    versionIds.length > 0
      ? await db.seoContentVersion.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, uniquenessScore: true, seoQualityScore: true },
        })
      : [];
  const versionMap = new Map(versions.map((v) => [v.id, v]));

  let priorUniqueSum = 0;
  let priorUniqueCount = 0;
  let improvedCount = 0;
  let unchangedCount = 0;

  for (const item of completed) {
    const snap = item.versionId ? versionMap.get(item.versionId) : null;
    const priorU = snap?.uniquenessScore;
    const newU = item.predictedUnique;
    if (priorU != null) {
      priorUniqueSum += priorU;
      priorUniqueCount++;
    }
    if (priorU != null && newU != null && newU > priorU) improvedCount++;
    else unchangedCount++;
  }

  const avgUniqueness =
    completed.length > 0
      ? completed.reduce((s, i) => s + (i.predictedUnique ?? 0), 0) / completed.length
      : null;
  const avgSeoScore =
    completed.length > 0
      ? completed.reduce((s, i) => s + (i.predictedScore ?? 0), 0) / completed.length
      : null;
  const avgPriorUniqueness =
    priorUniqueCount > 0 ? priorUniqueSum / priorUniqueCount : null;
  const avgPriorSeo =
    priorUniqueCount > 0
      ? completed.reduce((s, i) => {
          const snap = i.versionId ? versionMap.get(i.versionId) : null;
          return s + (snap?.seoQualityScore ?? 0);
        }, 0) / priorUniqueCount
      : null;

  const lowRiskCount = completed.filter((i) => i.predictedRisk === "low").length;
  const mediumRiskCount = completed.filter((i) => i.predictedRisk === "medium").length;
  const highRiskCount = completed.filter((i) => i.predictedRisk === "high").length;

  const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
  const report = {
    pagesUpdated: completed.length,
    pagesProcessed: allItems.length,
    pagesSkipped: run?.skippedCount ?? 0,
    pagesImproved: improvedCount,
    pagesUnchanged: unchangedCount,
    failures: run?.failedCount ?? 0,
    averageUniqueness: avgUniqueness,
    averagePriorUniqueness: avgPriorUniqueness,
    averageSeoScore: avgSeoScore,
    averagePriorSeoScore: avgPriorSeo,
    lowRiskCount,
    mediumRiskCount,
    highRiskCount,
  };

  await recomputeRunCounters(runId);

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
  if (runningRegenerationRuns.has(runId)) {
    return { totalProcessed: 0, batches: 0, alreadyRunning: true };
  }
  if (await isRegenerationRunCancelled(runId)) {
    return { totalProcessed: 0, batches: 0, cancelled: true };
  }

  runningRegenerationRuns.add(runId);
  let batches = 0;
  let totalProcessed = 0;
  try {
    while (batches < maxBatches) {
      if (await isRegenerationRunCancelled(runId)) {
        console.log("SEO_REGEN_STOP_CANCELLED", { runId, batches });
        break;
      }

      const result = await processRegenerationBatch(runId);
      if ("busy" in result && result.busy) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      totalProcessed += result.processed ?? 0;
      if (result.done) {
        console.log("SEO_REGEN_COMPLETE", { runId, totalProcessed, batches });
        break;
      }
      batches++;
    }
  } finally {
    runningRegenerationRuns.delete(runId);
    clearRegenerationCaches();
  }
  return { totalProcessed, batches };
}

export function kickOffRegenerationProcessing(runId: string) {
  if (cancelledRegenerationRuns.has(runId)) {
    console.log("SEO_REGEN_KICKOFF_SKIP", { runId, reason: "cancelled" });
    return;
  }
  if (runningRegenerationRuns.has(runId)) {
    console.log("SEO_REGEN_KICKOFF_SKIP", { runId, reason: "already_running" });
    return;
  }
  console.log("SEO_REGEN_KICKOFF", { runId });
  scheduleSeoBackgroundWork(`seo-regen:${runId}`, async () => {
    if (await isRegenerationRunCancelled(runId)) return;
    await processRunUntilDone(runId);
  });
}

export async function resumeStaleRegenerationRuns() {
  const stale = await db.seoRegenerationRun.findMany({
    where: {
      status: { in: ["queued", "processing"] },
      confirmed: true,
      dryRun: false,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (stale.length > 0) {
    console.log("SEO_REGEN_RESUME_STALE", { count: stale.length, ids: stale.map((r) => r.id) });
  }
  for (const run of stale) {
    if (cancelledRegenerationRuns.has(run.id)) continue;
    await failStaleRegenerationItems(run.id);
    await recomputeRunCounters(run.id);
    kickOffRegenerationProcessing(run.id);
  }
  return stale.length;
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
}) {
  const clamped = clampRunProgressFields(run.totalPages, {
    completedCount: run.completedCount,
    queuedCount: run.queuedCount,
    processingCount: run.processingCount,
    failedCount: run.failedCount,
    skippedCount: run.skippedCount,
  });
  const remaining = clamped.remaining;
  const elapsedMs =
    run.startedAt != null
      ? (run.completedAt ?? new Date()).getTime() - run.startedAt.getTime()
      : null;

  const doneCount = clamped.completedCount + clamped.failedCount + clamped.skippedCount;
  const estimatedRemainingMs =
    elapsedMs != null && doneCount > 0 && remaining > 0
      ? Math.round((elapsedMs / doneCount) * remaining)
      : null;

  return {
    id: run.id,
    status: run.status,
    mode: run.mode,
    dryRun: run.dryRun,
    confirmed: run.confirmed,
    batchSize: run.batchSize,
    totalPages: run.totalPages,
    queued: clamped.queuedCount,
    processing: clamped.processingCount,
    completed: clamped.completedCount,
    failed: clamped.failedCount,
    skipped: clamped.skippedCount,
    remaining,
    avgUniqueness: run.avgUniqueness,
    avgSeoScore: run.avgSeoScore,
    lowRiskCount: run.lowRiskCount,
    mediumRiskCount: run.mediumRiskCount,
    highRiskCount: run.highRiskCount,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    elapsedMs,
    estimatedRemainingMs,
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
  cancelledRegenerationRuns.add(runId);
  runningRegenerationRuns.delete(runId);

  await db.seoRegenerationItem.updateMany({
    where: { runId, status: { in: ["queued", "processing"] } },
    data: {
      status: "skipped",
      error: "Run cancelled",
      processedAt: new Date(),
    },
  });

  await recomputeRunCounters(runId);

  const updated = await db.seoRegenerationRun.update({
    where: { id: runId },
    data: { status: "cancelled", completedAt: new Date() },
  });

  console.log("SEO_REGEN_CANCELLED", { runId });
  return updated;
}

export async function resumeRegenerationRun(runId: string, untilDone = false) {
  const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  if (!run.dryRun && !run.confirmed) throw new Error("Run not confirmed");
  if (run.status === "cancelled") throw new Error("Run was cancelled");

  cancelledRegenerationRuns.delete(runId);
  await failStaleRegenerationItems(runId);

  const queued = await db.seoRegenerationItem.count({ where: { runId, status: "queued" } });
  if (queued === 0) {
    await finalizeRun(runId);
    return { resumed: false, message: "No queued items", totalProcessed: 0, done: true };
  }

  await db.seoRegenerationRun.update({
    where: { id: runId },
    data: { status: "queued", startedAt: run.startedAt ?? new Date(), completedAt: null },
  });

  if (untilDone) {
    kickOffRegenerationProcessing(runId);
    return { resumed: true, background: true, totalProcessed: 0, done: false };
  }

  return processRegenerationBatch(runId);
}
