import "server-only";

import { db } from "@/lib/db";
import { SEO_LONGTAIL_KEYWORDS } from "@/lib/seo-internal-links";
import { generateUniversalSeoContent } from "@/lib/seo-universal-engine";
import {
  attachCityPackDryRunPreview,
  completeCityPackJob,
  deleteCityPackJob,
  failCityPackJob,
  getCityPackPreviewPage,
  markCityPackJobCommitted,
  setCityPackQualitySettings,
  updateCityPackPreviewPages,
  updateCityPackJob,
  getCityPackJob,
  type CityPackStageTimings,
} from "@/lib/seo-city-pack-job";
import {
  buildReviewPageFromGeneration,
  generateReviewPageContent,
  isWeakPage,
  serializeReviewPageForApi,
  type CityPackQualitySettings,
  type CityPackReviewPage,
} from "@/lib/seo-city-pack-review";
import type { SEOContent } from "@/lib/seo-content";
import {
  upsertFromContent,
  type GenerateResult,
  type SeoPageType,
} from "@/lib/seo-page-service";

const CITY_PACK_CONCURRENCY = 4;

type CityPackWorkItem = {
  pageType: SeoPageType;
  pageSlug: string;
  phase: "city" | "category_city" | "longtail";
  skip: boolean;
};

function buildCityPackWorkList(
  ctx: CitySeoContext,
  categories: Array<{ slug: string }>,
  existing: Record<SeoPageType, Set<string>>,
): CityPackWorkItem[] {
  const items: CityPackWorkItem[] = [
    {
      pageType: "city",
      pageSlug: ctx.citySlug,
      phase: "city",
      skip: existing.city.has(ctx.citySlug),
    },
  ];
  for (const category of categories) {
    const pageSlug = `${category.slug}/${ctx.citySlug}`;
    items.push({
      pageType: "category_city",
      pageSlug,
      phase: "category_city",
      skip: existing.category_city.has(pageSlug),
    });
  }
  for (const keyword of SEO_LONGTAIL_KEYWORDS) {
    const pageSlug = `${keyword.slug}/${ctx.citySlug}`;
    items.push({
      pageType: "longtail",
      pageSlug,
      phase: "longtail",
      skip: existing.longtail.has(pageSlug),
    });
  }
  return items;
}

export interface CitySeoContext {
  cityId: string;
  cityName: string;
  citySlug: string;
  stateName: string;
  stateSlug: string;
  countryName: string;
  countrySlug: string;
}

export interface GranularSeoPreview {
  cityId: string;
  cityName: string;
  stateName: string;
  countryName: string;
  categoryName?: string;
  categorySlug?: string;
  toGenerate: number;
  toSkip: number;
  total: number;
  breakdown: {
    city: number;
    categoryCity: number;
    longtail: number;
  };
}

export interface GranularGenerateResult extends GenerateResult {
  cityName: string;
  stateName: string;
  countryName: string;
  categoryName?: string;
}

async function getExistingSlugsForTypes(
  types: SeoPageType[],
): Promise<Record<SeoPageType, Set<string>>> {
  const rows = await db.seoPage.findMany({
    where: { pageType: { in: types } },
    select: { pageType: true, pageSlug: true },
  });
  const map: Record<SeoPageType, Set<string>> = {
    city: new Set(),
    category: new Set(),
    category_city: new Set(),
    state: new Set(),
    country: new Set(),
    longtail: new Set(),
  };
  for (const row of rows) {
    const type = row.pageType as SeoPageType;
    if (map[type]) map[type].add(row.pageSlug);
  }
  return map;
}

export async function loadCitySeoContext(cityId: string): Promise<CitySeoContext | null> {
  const city = await db.city.findUnique({
    where: { id: cityId },
    select: {
      id: true,
      name: true,
      slug: true,
      state: {
        select: {
          name: true,
          slug: true,
          country: { select: { name: true, slug: true } },
        },
      },
    },
  });
  if (!city?.state) return null;
  return {
    cityId: city.id,
    cityName: city.name,
    citySlug: city.slug,
    stateName: city.state.name,
    stateSlug: city.state.slug,
    countryName: city.state.country?.name || "India",
    countrySlug: city.state.country?.slug || "india",
  };
}

async function loadActiveCategories() {
  return db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

function countCityPackCandidates(
  ctx: CitySeoContext,
  categories: Array<{ slug: string }>,
  existing: Record<SeoPageType, Set<string>>,
): GranularSeoPreview {
  let cityMissing = existing.city.has(ctx.citySlug) ? 0 : 1;
  let categoryCityMissing = 0;
  let longtailMissing = 0;

  for (const category of categories) {
    const slug = `${category.slug}/${ctx.citySlug}`;
    if (!existing.category_city.has(slug)) categoryCityMissing++;
  }
  for (const keyword of SEO_LONGTAIL_KEYWORDS) {
    const slug = `${keyword.slug}/${ctx.citySlug}`;
    if (!existing.longtail.has(slug)) longtailMissing++;
  }

  const toGenerate = cityMissing + categoryCityMissing + longtailMissing;
  const total = 1 + categories.length + SEO_LONGTAIL_KEYWORDS.length;
  const toSkip = total - toGenerate;

  return {
    cityId: ctx.cityId,
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
    toGenerate,
    toSkip,
    total,
    breakdown: {
      city: cityMissing,
      categoryCity: categoryCityMissing,
      longtail: longtailMissing,
    },
  };
}

export async function previewCitySeoPack(cityId: string): Promise<GranularSeoPreview | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;
  const [categories, existing] = await Promise.all([
    loadActiveCategories(),
    getExistingSlugsForTypes(["city", "category_city", "longtail"]),
  ]);
  return countCityPackCandidates(ctx, categories, existing);
}

export async function previewSingleCityPage(cityId: string): Promise<GranularSeoPreview | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;
  const existing = await getExistingSlugsForTypes(["city"]);
  const toGenerate = existing.city.has(ctx.citySlug) ? 0 : 1;
  return {
    cityId: ctx.cityId,
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
    toGenerate,
    toSkip: 1 - toGenerate,
    total: 1,
    breakdown: { city: toGenerate, categoryCity: 0, longtail: 0 },
  };
}

export async function previewCategoryCityPage(
  cityId: string,
  categoryId: string,
): Promise<GranularSeoPreview | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;
  const category = await db.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true, slug: true, name: true },
  });
  if (!category) return null;

  const existing = await getExistingSlugsForTypes(["category_city"]);
  const pageSlug = `${category.slug}/${ctx.citySlug}`;
  const toGenerate = existing.category_city.has(pageSlug) ? 0 : 1;

  return {
    cityId: ctx.cityId,
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
    categoryName: category.name,
    categorySlug: category.slug,
    toGenerate,
    toSkip: 1 - toGenerate,
    total: 1,
    breakdown: { city: 0, categoryCity: toGenerate, longtail: 0 },
  };
}

async function processCityPackWorkItem(input: {
  jobId: string;
  ctx: CitySeoContext;
  item: CityPackWorkItem;
  dryRun: boolean;
  settings: CityPackQualitySettings;
  stageTimings: CityPackStageTimings;
}): Promise<{
  reviewPage?: CityPackReviewPage;
  example?: GenerateResult["examples"][number];
  created: boolean;
  failed: boolean;
  error?: string;
}> {
  const { jobId, ctx, item, dryRun, settings, stageTimings } = input;

  const phaseLabel =
    item.phase === "city"
      ? "City generation started"
      : item.phase === "category_city"
        ? "Category-city generation started"
        : "Longtail generation started";

  updateCityPackJob(jobId, {
    currentStage: item.phase,
    currentPage: item.pageSlug,
    log: `${phaseLabel} — ${item.pageSlug}`,
  });

  try {
    const genStart = Date.now();
    updateCityPackJob(jobId, {
      currentStage: "local_intelligence",
      log: `Local intelligence + listing context — ${item.pageSlug}`,
    });

    const gen = await generateReviewPageContent({
      pageType: item.pageType,
      pageSlug: item.pageSlug,
      citySlug: ctx.citySlug,
      mode: "generate",
      settings,
    });

    const genMs = Date.now() - genStart;
    stageTimings.introGeneration = (stageTimings.introGeneration ?? 0) + genMs;
    stageTimings.uniquenessCheck = (stageTimings.uniquenessCheck ?? 0) + gen.generationTimeMs;

    if (typeof gen.metadata.paragraphsRewritten === "number") {
      stageTimings.duplicateFixing =
        (stageTimings.duplicateFixing ?? 0) + Number(gen.metadata.paragraphsRewritten);
    }

    updateCityPackJob(jobId, {
      currentStage: "uniqueness_check",
      log: `Generation completed in ${genMs}ms — ${item.pageSlug}`,
    });

    if (dryRun) {
      updateCityPackJob(jobId, {
        currentStage: "dry_run_preview",
        log: `Dry run scoring — ${item.pageSlug}`,
      });
      const reviewPage = await buildReviewPageFromGeneration({
        pageType: item.pageType,
        pageSlug: item.pageSlug,
        content: gen.content,
        canonicalUrl: gen.canonicalUrl,
        generationTimeMs: gen.generationTimeMs,
        settings,
        rawMeta: gen.metadata,
      });
      updateCityPackJob(jobId, {
        log: `Dry run preview stored (no save) — ${item.pageSlug}`,
      });
      return {
        reviewPage,
        example: {
          pageType: item.pageType,
          pageSlug: item.pageSlug,
          canonicalUrl: gen.canonicalUrl,
          title: gen.content.title,
        },
        created: true,
        failed: false,
      };
    }

    updateCityPackJob(jobId, {
      currentStage: "save_started",
      log: `Save started — ${item.pageSlug}`,
    });
    const saveStart = Date.now();
    const canonicalUrl =
      gen.canonicalUrl ??
      (item.pageType === "city"
        ? `/${ctx.countrySlug}/${ctx.stateSlug}/${ctx.citySlug}`
        : `/${item.pageSlug}`);
    await upsertFromContent(item.pageType, item.pageSlug, gen.content, canonicalUrl);
    stageTimings.save = (stageTimings.save ?? 0) + (Date.now() - saveStart);
    updateCityPackJob(jobId, { log: `Save completed — ${item.pageSlug}` });

    return {
      example: {
        pageType: item.pageType,
        pageSlug: item.pageSlug,
        canonicalUrl,
        title: gen.content.title,
      },
      created: true,
      failed: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Page generation failed";
    const job = updateCityPackJob(jobId, {
      currentStage: "page_failed",
      log: `Page failed — ${item.pageSlug}: ${msg}`,
    });
    if (job) job.errors.push(msg);
    return { created: false, failed: true, error: msg };
  }
}

/** Background job runner — updates progress, never leaves pending promises. */
export async function runCityPackJob(
  jobId: string,
  cityId: string,
  dryRun = false,
): Promise<void> {
  const packStart = Date.now();
  const stageTimings: CityPackStageTimings = {};

  updateCityPackJob(jobId, {
    status: "running",
    currentStage: "initializing",
    log: `Request received — cityId=${cityId} dryRun=${dryRun}`,
  });

  try {
    const ctx = await loadCitySeoContext(cityId);
    if (!ctx) {
      failCityPackJob(jobId, "City not found");
      return;
    }

    const job = getCityPackJob(jobId);
    const settings = job?.qualitySettings ?? {
      minSeo: 75,
      minUniqueness: 60,
      minReadability: 70,
      productionMinSeo: 90,
      productionMinUniqueness: 85,
      productionMinReadability: 80,
      retryUntilSeo: null,
      retryUntilUniqueness: null,
      maxRetries: 3,
    };

    const loadStart = Date.now();
    const [categories, existing] = await Promise.all([
      loadActiveCategories(),
      getExistingSlugsForTypes(["city", "category_city", "longtail"]),
    ]);
    stageTimings.listingContext = Date.now() - loadStart;

    const work = buildCityPackWorkList(ctx, categories, existing);
    updateCityPackJob(jobId, {
      total: work.length,
      cityName: ctx.cityName,
      log: `City pack started — ${work.length} page(s), ${work.filter((w) => !w.skip).length} to generate (${CITY_PACK_CONCURRENCY} workers)`,
    });

    const examples: GenerateResult["examples"] = [];
    const dryRunPages: CityPackReviewPage[] = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;
    let completed = 0;

    for (const item of work.filter((w) => w.skip)) {
      skipped++;
      completed++;
      updateCityPackJob(jobId, {
        completed,
        skipped,
        currentStage: "skipped",
        currentPage: item.pageSlug,
        log: `Skipped existing page — ${item.pageSlug}`,
      });
    }

    const toGenerate = work.filter((w) => !w.skip);
    let nextIndex = 0;

    const runWorker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= toGenerate.length) break;
        const item = toGenerate[i];
        const outcome = await processCityPackWorkItem({
          jobId,
          ctx,
          item,
          dryRun,
          settings,
          stageTimings,
        });

        if (outcome.failed) failed++;
        else if (outcome.created) created++;

        completed++;
        if (outcome.example && examples.length < 5) examples.push(outcome.example);
        if (outcome.reviewPage) dryRunPages.push(outcome.reviewPage);

        updateCityPackJob(jobId, { completed, created, skipped, failed });
      }
    };

    const workerCount = Math.min(CITY_PACK_CONCURRENCY, toGenerate.length);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    if (dryRun) {
      attachCityPackDryRunPreview(jobId, dryRunPages);
    }

    const result: GranularGenerateResult = {
      created,
      skipped,
      total: work.length,
      examples,
      cityName: ctx.cityName,
      stateName: ctx.stateName,
      countryName: ctx.countryName,
    };

    stageTimings.total = Date.now() - packStart;
    completeCityPackJob(jobId, result, stageTimings);
    console.log("CITY_PACK_DONE", {
      jobId,
      dryRun,
      created: result.created,
      skipped: result.skipped,
      failed,
      durationMs: stageTimings.total,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "City pack job failed";
    failCityPackJob(jobId, msg);
    console.error("CITY_PACK_FATAL", { jobId, error: msg });
  }
}

async function regeneratePreviewPageInternal(
  jobId: string,
  pageSlug: string,
  mode: "regenerate" | "optimize",
): Promise<CityPackReviewPage> {
  const job = getCityPackJob(jobId);
  if (!job?.dryRunPreview) throw new Error("Preview not available");
  const existing = getCityPackPreviewPage(jobId, pageSlug);
  if (!existing) throw new Error(`Page not found in preview: ${pageSlug}`);

  const ctx = await loadCitySeoContext(job.cityId);
  if (!ctx) throw new Error("City not found");

  const priorSnapshot = {
    seo: existing.seo,
    uniqueness: existing.uniqueness,
    readability: existing.readability,
    intro: existing.introPreview,
  };

  const gen = await generateReviewPageContent({
    pageType: existing.pageType as SeoPageType,
    pageSlug,
    citySlug: ctx.citySlug,
    mode,
    settings: job.qualitySettings,
  });

  const flags =
    mode === "optimize"
      ? { improved: true as const }
      : { regenerated: true as const };

  const reviewPage = await buildReviewPageFromGeneration({
    pageType: existing.pageType as SeoPageType,
    pageSlug,
    content: gen.content,
    canonicalUrl: gen.canonicalUrl,
    generationTimeMs: gen.generationTimeMs,
    settings: job.qualitySettings,
    flags,
    priorSnapshot,
    rawMeta: gen.metadata,
  });

  updateCityPackPreviewPages(jobId, (pages) =>
    pages.map((p) => (p.pageSlug === pageSlug ? reviewPage : p)),
  );

  return reviewPage;
}

export async function regenerateCityPackPreviewPage(
  jobId: string,
  pageSlug: string,
): Promise<CityPackReviewPage> {
  return regeneratePreviewPageInternal(jobId, pageSlug, "regenerate");
}

export async function improveCityPackPreviewPage(
  jobId: string,
  pageSlug: string,
): Promise<CityPackReviewPage> {
  return regeneratePreviewPageInternal(jobId, pageSlug, "optimize");
}

export async function bulkRegenerateCityPackPages(
  jobId: string,
  pageSlugs: string[],
): Promise<CityPackReviewPage[]> {
  const updated: CityPackReviewPage[] = [];
  for (const slug of pageSlugs) {
    try {
      updated.push(await regenerateCityPackPreviewPage(jobId, slug));
    } catch (err) {
      console.error("BULK_REGEN_PAGE_FAILED", { jobId, slug, err });
    }
  }
  return updated;
}

export async function bulkImproveCityPackPages(
  jobId: string,
  pageSlugs: string[],
): Promise<CityPackReviewPage[]> {
  const updated: CityPackReviewPage[] = [];
  for (const slug of pageSlugs) {
    try {
      updated.push(await improveCityPackPreviewPage(jobId, slug));
    } catch (err) {
      console.error("BULK_IMPROVE_PAGE_FAILED", { jobId, slug, err });
    }
  }
  return updated;
}

export async function improveAllWeakCityPackPages(jobId: string): Promise<CityPackReviewPage[]> {
  const job = getCityPackJob(jobId);
  if (!job?.dryRunPreview) throw new Error("Preview not available");
  const weak = job.dryRunPreview.pages
    .filter((p) => isWeakPage(p, job.qualitySettings))
    .map((p) => p.pageSlug);
  return bulkImproveCityPackPages(jobId, weak);
}

export function discardCityPackPreviewPages(jobId: string, pageSlugs: string[]): number {
  let removed = 0;
  updateCityPackPreviewPages(jobId, (pages) => {
    const slugs = new Set(pageSlugs);
    const next = pages.filter((p) => {
      if (slugs.has(p.pageSlug)) {
        removed++;
        return false;
      }
      return true;
    });
    return next;
  });
  return removed;
}

export function getCityPackPageDetail(jobId: string, pageSlug: string) {
  const page = getCityPackPreviewPage(jobId, pageSlug);
  if (!page) return null;
  return serializeReviewPageForApi(page, true);
}

export function updateCityPackReviewSettings(
  jobId: string,
  settings: Partial<CityPackQualitySettings>,
) {
  return setCityPackQualitySettings(jobId, settings);
}

export type CommitDryRunMode = "production_only" | "selected" | "all_anyway";

export function buildCommitSummary(jobId: string, slugs?: string[]) {
  const job = getCityPackJob(jobId);
  if (!job?.dryRunPreview) throw new Error("Preview not ready");

  const pages = slugs?.length
    ? job.dryRunPreview.pages.filter((p) => slugs.includes(p.pageSlug))
    : job.dryRunPreview.pages;

  const excellent = pages.filter((p) => p.productionReady).length;
  const weakSeo = pages.filter((p) => p.seo < job.qualitySettings.minSeo).length;
  const weakUniqueness = pages.filter(
    (p) => p.uniqueness < job.qualitySettings.minUniqueness,
  ).length;
  const duplicates = pages.filter((p) => p.duplicateRisk === "high").length;
  const needsImprovement = pages.filter((p) => !p.productionReady).length;

  return {
    total: pages.length,
    excellent,
    weakSeo,
    weakUniqueness,
    duplicates,
    needsImprovement,
    productionReady: excellent,
    commitProductionOnly: excellent,
  };
}

/** Synchronous path — delegates to job runner logic inline (legacy / tests). */
export async function generateCitySeoPack(
  cityId: string,
  options?: { dryRun?: boolean },
): Promise<GranularGenerateResult | null> {
  const { createCityPackJob } = await import("@/lib/seo-city-pack-job");
  const preview = await previewCitySeoPack(cityId);
  if (!preview) return null;

  const job = createCityPackJob({
    cityId,
    cityName: preview.cityName,
    total: preview.total,
    dryRun: options?.dryRun,
  });
  await runCityPackJob(job.jobId, cityId, options?.dryRun === true);
  const { getCityPackJob } = await import("@/lib/seo-city-pack-job");
  const finished = getCityPackJob(job.jobId);
  if (!finished || finished.status !== "completed" || !finished.result) {
    throw new Error(finished?.errors.join("; ") || "City pack generation failed");
  }
  return finished.result;
}

export async function generateSingleCitySeoPage(
  cityId: string,
): Promise<GranularGenerateResult | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;

  const existing = await getExistingSlugsForTypes(["city"]);
  if (existing.city.has(ctx.citySlug)) {
    return {
      created: 0,
      skipped: 1,
      total: 1,
      examples: [],
      cityName: ctx.cityName,
      stateName: ctx.stateName,
      countryName: ctx.countryName,
    };
  }

  const result = await generateUniversalSeoContent({
    pageType: "city",
    citySlug: ctx.citySlug,
    mode: "generate",
  });
  const canonicalUrl =
    result.canonicalUrl ?? `/${ctx.countrySlug}/${ctx.stateSlug}/${ctx.citySlug}`;
  await upsertFromContent("city", ctx.citySlug, result.content, canonicalUrl);

  return {
    created: 1,
    skipped: 0,
    total: 1,
    examples: [{
      pageType: "city",
      pageSlug: ctx.citySlug,
      canonicalUrl,
      title: result.content.title,
    }],
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
  };
}

export async function generateSingleCategoryCitySeoPage(
  cityId: string,
  categoryId: string,
): Promise<GranularGenerateResult | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;

  const category = await db.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { slug: true, name: true },
  });
  if (!category) return null;

  const existing = await getExistingSlugsForTypes(["category_city"]);
  const pageSlug = `${category.slug}/${ctx.citySlug}`;

  if (existing.category_city.has(pageSlug)) {
    return {
      created: 0,
      skipped: 1,
      total: 1,
      examples: [],
      cityName: ctx.cityName,
      stateName: ctx.stateName,
      countryName: ctx.countryName,
      categoryName: category.name,
    };
  }

  const result = await generateUniversalSeoContent({
    pageType: "category_city",
    pageSlug,
    mode: "generate",
  });
  const canonicalUrl = result.canonicalUrl ?? `/${category.slug}/${ctx.citySlug}`;
  await upsertFromContent("category_city", pageSlug, result.content, canonicalUrl);

  return {
    created: 1,
    skipped: 0,
    total: 1,
    examples: [{
      pageType: "category_city",
      pageSlug,
      canonicalUrl,
      title: result.content.title,
    }],
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
    categoryName: category.name,
  };
}

/** Commit dry-run preview pages to database, then clean up job. */
export async function commitCityPackDryRun(
  jobId: string,
  options?: { mode?: CommitDryRunMode; slugs?: string[] },
): Promise<{
  committed: number;
  skipped: number;
  failed: number;
  rejected: number;
  cityName: string;
  countryName: string;
  stateName: string;
}> {
  const job = getCityPackJob(jobId);
  if (!job) throw new Error("Job not found or expired");
  if (!job.dryRun) throw new Error("Job is not a dry run");
  if (!job.previewReady || !job.dryRunPreview?.pages.length) {
    throw new Error("Preview not ready");
  }
  if (job.committedAt) throw new Error("Job already committed");

  const mode = options?.mode ?? "production_only";
  const slugSet = options?.slugs?.length ? new Set(options.slugs) : null;

  const auditMeta = {
    cityName: job.result?.cityName ?? job.cityName,
    countryName: job.result?.countryName ?? "",
    stateName: job.result?.stateName ?? "",
  };

  let committed = 0;
  let skipped = 0;
  let failed = 0;
  let rejected = 0;

  for (const page of job.dryRunPreview.pages) {
    if (slugSet && !slugSet.has(page.pageSlug)) {
      skipped++;
      continue;
    }

    const eligible = mode === "all_anyway" ? true : page.productionReady;

    if (!eligible) {
      rejected++;
      continue;
    }

    try {
      const content = JSON.parse(page.contentJson) as SEOContent;
      await upsertFromContent(
        page.pageType as SeoPageType,
        page.pageSlug,
        content,
        page.canonicalUrl,
      );
      committed++;
    } catch (err) {
      failed++;
      console.error("CITY_PACK_COMMIT_PAGE_FAILED", {
        jobId,
        pageSlug: page.pageSlug,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  markCityPackJobCommitted(jobId);
  deleteCityPackJob(jobId, "committed");
  return { committed, skipped, failed, rejected, ...auditMeta };
}

export function resolveSeoGranularAccess(role: string | undefined): 401 | 403 | null {
  if (!role) return 401;
  if (role.toLowerCase() !== "admin") return 403;
  return null;
}
