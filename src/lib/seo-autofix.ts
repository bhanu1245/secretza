import { db } from "@/lib/db";
import {
  buildRegeneratedContent,
  clearRegenerationCaches,
  regenerateSeoPageById,
} from "@/lib/seo-regeneration-service";
import { buildSchemaJson } from "@/lib/seo-page-service";
import {
  SEO_IMAGE_PLACEHOLDER,
  buildDefaultImageAlt,
  buildDefaultImageCaption,
  buildDefaultImageTitle,
  enrichSchemaWithFeaturedImage,
  generateAndStoreSeoImage,
  resolveSeoImageUrl,
  seoImageStorageKey,
} from "@/lib/seo-images";
import {
  SEO_MIN_WORD_COUNT,
  calculateVisibleWordCount,
  computeContentHash,
} from "@/lib/seo-quality";
import {
  calculateInternalLinksCount,
  findBrokenLinksInContent,
  buildLinkContextFromPage,
  MIN_INTERNAL_LINKS_PER_PAGE,
  sanitizeStoredIntroContent,
} from "@/lib/seo-internal-links";
import { isSeoPageRoutable } from "@/lib/seo-route-validation";

const MIN_INTERNAL_LINKS = MIN_INTERNAL_LINKS_PER_PAGE;

/** Issue types supported by the universal Auto Fix router. */
export type AutoFixIssueType =
  | "missing_title"
  | "missing_meta"
  | "missing_h1"
  | "missing_canonical"
  | "invalid_canonical"
  | "missing_schema"
  | "missing_image"
  | "thin_content"
  | "missing_internal_links"
  | "duplicate_titles"
  | "duplicate_meta"
  | "duplicate_h1"
  | "duplicate_content"
  | "broken_internal_links";

export type AutoFixStrategy =
  | "regenerate"
  | "repair_canonical"
  | "repair_schema"
  | "assign_image"
  | "repair_broken_links";

export interface AutoFixPageDetail {
  pageId: string;
  pageSlug: string;
  status: "changed" | "skipped" | "failed";
  strategy: AutoFixStrategy;
  reason?: string;
}

export interface UniversalAutoFixResult {
  processed: number;
  changed: number;
  skipped: number;
  failed: number;
  strategy: AutoFixStrategy;
  details: AutoFixPageDetail[];
  message: string;
}

/** Legacy shape kept for backward compatibility with duplicate-field helper. */
export interface AutoFixResult {
  scanned: number;
  changed: number;
  unchanged: number;
  changedIds: string[];
  details: Array<{ id: string; field: string; from: string; to: string }>;
}

const ISSUE_STRATEGY_MAP: Record<AutoFixIssueType, AutoFixStrategy> = {
  duplicate_titles: "regenerate",
  missing_title: "regenerate",
  duplicate_meta: "regenerate",
  missing_meta: "regenerate",
  duplicate_h1: "regenerate",
  missing_h1: "regenerate",
  missing_canonical: "repair_canonical",
  invalid_canonical: "repair_canonical",
  missing_schema: "repair_schema",
  thin_content: "regenerate",
  missing_internal_links: "regenerate",
  duplicate_content: "regenerate",
  missing_image: "assign_image",
  broken_internal_links: "repair_broken_links",
};

type SeoPageRow = {
  id: string;
  pageType: string;
  pageSlug: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  customData: string | null;
  featuredImage: string | null;
  imageAlt: string | null;
  wordCount: number | null;
  internalLinksCount: number | null;
  contentHash: string | null;
  introContent: string | null;
  updatedAt: Date;
};

type PageSnapshot = Pick<
  SeoPageRow,
  | "title"
  | "metaDescription"
  | "h1"
  | "canonicalUrl"
  | "customData"
  | "featuredImage"
  | "wordCount"
  | "internalLinksCount"
  | "contentHash"
  | "updatedAt"
>;

const PAGE_SELECT = {
  id: true,
  pageType: true,
  pageSlug: true,
  title: true,
  metaDescription: true,
  h1: true,
  canonicalUrl: true,
  customData: true,
  featuredImage: true,
  imageAlt: true,
  wordCount: true,
  internalLinksCount: true,
  contentHash: true,
  introContent: true,
  updatedAt: true,
} as const;

export function resolveAutoFixStrategy(issueType: string): AutoFixStrategy | null {
  return ISSUE_STRATEGY_MAP[issueType as AutoFixIssueType] ?? null;
}

function snapshot(page: SeoPageRow): PageSnapshot {
  return {
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    canonicalUrl: page.canonicalUrl,
    customData: page.customData,
    featuredImage: page.featuredImage,
    wordCount: page.wordCount,
    internalLinksCount: page.internalLinksCount,
    contentHash: page.contentHash,
    updatedAt: page.updatedAt,
  };
}

function snapshotsEqual(a: PageSnapshot, b: PageSnapshot): boolean {
  return (
    a.title === b.title &&
    a.metaDescription === b.metaDescription &&
    a.h1 === b.h1 &&
    a.canonicalUrl === b.canonicalUrl &&
    a.customData === b.customData &&
    a.featuredImage === b.featuredImage &&
    a.wordCount === b.wordCount &&
    a.internalLinksCount === b.internalLinksCount &&
    a.contentHash === b.contentHash
  );
}

function hasSchemaMarkup(customData: string | null | undefined): boolean {
  if (!customData?.trim()) return false;
  return customData.includes('"@type"');
}

function parsePageLocation(page: { pageType: string; pageSlug: string }) {
  const slash = page.pageSlug.indexOf("/");
  if (page.pageType === "city") {
    return { citySlug: page.pageSlug, categorySlug: null as string | null };
  }
  if (slash < 0) {
    return { citySlug: null as string | null, categorySlug: null as string | null };
  }
  return {
    categorySlug: page.pageSlug.slice(0, slash),
    citySlug: page.pageSlug.slice(slash + 1),
  };
}

async function countDuplicateValue(
  field: "title" | "metaDescription" | "h1" | "contentHash",
  value: string | null | undefined,
): Promise<number> {
  if (!value?.trim()) return 0;
  return db.seoPage.count({ where: { [field]: value } });
}

async function expectedCanonicalUrl(
  pageType: string,
  pageSlug: string,
): Promise<string | null> {
  const built = await buildRegeneratedContent(pageType, pageSlug, {
    ignoreExistingCanonical: true,
  });
  return built?.canonicalUrl ?? null;
}

/** Returns true when the page still matches the drill-down issue filter. */
export async function pageHasIssue(
  page: SeoPageRow,
  issueType: string,
): Promise<boolean> {
  switch (issueType as AutoFixIssueType) {
    case "missing_title":
      return !page.title?.trim();
    case "missing_meta":
      return !page.metaDescription?.trim();
    case "missing_h1":
      return !page.h1?.trim();
    case "missing_canonical":
      return !page.canonicalUrl?.trim();
    case "invalid_canonical": {
      const expected = await expectedCanonicalUrl(page.pageType, page.pageSlug);
      return Boolean(expected && page.canonicalUrl?.trim() !== expected);
    }
    case "missing_schema":
      return !hasSchemaMarkup(page.customData);
    case "missing_image":
      return !(await isFeaturedImageValid(page));
    case "thin_content":
      return (page.wordCount ?? 0) < SEO_MIN_WORD_COUNT;
    case "missing_internal_links":
      return (page.internalLinksCount ?? 0) < MIN_INTERNAL_LINKS;
    case "duplicate_titles":
      return (await countDuplicateValue("title", page.title)) > 1;
    case "duplicate_meta":
      return (await countDuplicateValue("metaDescription", page.metaDescription)) > 1;
    case "duplicate_h1":
      return (await countDuplicateValue("h1", page.h1)) > 1;
    case "duplicate_content":
      return (await countDuplicateValue("contentHash", page.contentHash)) > 1;
    case "broken_internal_links": {
      if (!page.introContent?.trim()) return false;
      const context = buildLinkContextFromPage(page.pageType, page.pageSlug);
      const broken = await findBrokenLinksInContent(page.introContent, context);
      return broken.length > 0;
    }
    default:
      return false;
  }
}

function humanizeSlugTail(pageSlug: string): string {
  const seg = pageSlug.includes("/")
    ? pageSlug.split("/").filter(Boolean).pop() ?? pageSlug
    : pageSlug;
  return seg
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function insertTitleQualifier(title: string, suffix: string): string {
  const sep = " | ";
  const idx = title.lastIndexOf(sep);
  if (idx >= 0) {
    return `${title.slice(0, idx)} (${suffix})${title.slice(idx)}`;
  }
  return `${title} (${suffix})`;
}

function insertMetaQualifier(meta: string, suffix: string): string {
  const trimmed = meta.trimEnd();
  const base = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  return `${base} (${suffix}).`;
}

function insertH1Qualifier(h1: string, suffix: string): string {
  return h1.includes(`(${suffix})`) ? h1 : `${h1} (${suffix})`;
}

/**
 * Idempotent in-place de-duplication for title / meta / h1.
 * Used as a safe fallback when regeneration alone cannot break a collision.
 */
export async function autoFixDuplicateFields(
  pageIds: string[],
  field: "title" | "metaDescription" | "h1",
): Promise<AutoFixResult> {
  const result: AutoFixResult = {
    scanned: 0,
    changed: 0,
    unchanged: 0,
    changedIds: [],
    details: [],
  };

  if (pageIds.length === 0) return result;

  const pages = await db.seoPage.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      title: true,
      metaDescription: true,
      h1: true,
    },
  });
  result.scanned = pages.length;

  for (const page of pages) {
    const current =
      field === "title"
        ? page.title
        : field === "metaDescription"
          ? page.metaDescription
          : page.h1;
    if (!current) {
      result.unchanged++;
      continue;
    }

    const colliding = await db.seoPage.findMany({
      where: { [field]: current },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    if (colliding.length <= 1) {
      result.unchanged++;
      continue;
    }

    const keeperId = colliding[0]!.id;
    if (page.id === keeperId) {
      result.unchanged++;
      continue;
    }

    const suffix = humanizeSlugTail(page.pageSlug);
    if (!suffix || current.includes(`(${suffix})`)) {
      result.unchanged++;
      continue;
    }

    const next =
      field === "title"
        ? insertTitleQualifier(current, suffix)
        : field === "metaDescription"
          ? insertMetaQualifier(current, suffix)
          : insertH1Qualifier(current, suffix);

    if (next === current) {
      result.unchanged++;
      continue;
    }

    await db.seoPage.update({
      where: { id: page.id },
      data: { [field]: next },
    });

    result.changed++;
    result.changedIds.push(page.id);
    result.details.push({ id: page.id, field, from: current, to: next });
  }

  return result;
}

function humanizeSlugSegment(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Extract the page subject (e.g. "Female Escorts") from h1/title/slug — never from another page. */
function extractPageSubjectLabel(
  page: SeoPageRow,
  categorySlug: string | null,
): string {
  if (page.h1?.trim()) {
    const h1 = page.h1.trim();
    const inIdx = h1.toLowerCase().lastIndexOf(" in ");
    if (inIdx > 0) return h1.slice(0, inIdx).trim();
    return h1;
  }
  if (page.title?.trim()) {
    const withoutBrand = page.title.split("|")[0]?.trim() ?? page.title.trim();
    const dashIdx = withoutBrand.indexOf(" - ");
    const base = dashIdx > 0 ? withoutBrand.slice(0, dashIdx) : withoutBrand;
    const inIdx = base.toLowerCase().lastIndexOf(" in ");
    if (inIdx > 0) return base.slice(0, inIdx).trim();
    return base;
  }
  if (categorySlug) return humanizeSlugSegment(categorySlug);
  return humanizeSlugSegment(page.pageSlug);
}

export interface PageImageCopy {
  headline: string;
  subtitle: string;
  imageAlt: string;
  imageTitle: string;
  imageCaption: string;
}

/**
 * Build semantically correct image text from THIS page's metadata only.
 * Never reads or copies text from another SEO page.
 */
export async function buildPageSpecificImageCopy(
  page: SeoPageRow,
): Promise<PageImageCopy> {
  const { categorySlug, citySlug } = parsePageLocation(page);
  let cityName = citySlug ? humanizeSlugSegment(citySlug) : "";
  let stateName = "";

  if (citySlug) {
    const city = await db.city.findFirst({
      where: { slug: citySlug },
      select: { name: true, state: { select: { name: true } } },
    });
    if (city) {
      cityName = city.name;
      stateName = city.state?.name ?? "";
    }
  }

  const subject = extractPageSubjectLabel(page, categorySlug);
  const subjectLower = subject.toLowerCase();

  let headline: string;
  if (page.h1?.trim()) {
    let h1 = page.h1.trim();
    if (
      cityName &&
      !h1.toLowerCase().includes(" in ") &&
      h1.toLowerCase().endsWith(cityName.toLowerCase())
    ) {
      h1 = h1.replace(
        new RegExp(`\\s+${cityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"),
        ` in ${cityName}`,
      );
    }
    headline = /^verified\b/i.test(h1) ? h1 : `Verified ${h1}`;
  } else if (cityName) {
    headline = `Verified ${subject} in ${cityName}`;
  } else {
    headline = `Verified ${subject}`;
  }

  const subtitle =
    page.metaDescription?.trim() ||
    (cityName
      ? `Find verified ${subjectLower} in ${cityName}${stateName ? `, ${stateName}` : ""}. Browse listings, photos and reviews.`
      : `Find verified ${subjectLower} on SecretZa. Browse listings, photos and reviews.`);

  return {
    headline,
    subtitle,
    imageAlt: buildDefaultImageAlt(headline, page.pageType),
    imageTitle: buildDefaultImageTitle(headline),
    imageCaption: buildDefaultImageCaption(headline, page.pageType),
  };
}

function ownSeoImageStorageKey(page: SeoPageRow): string {
  return seoImageStorageKey(page.pageType, page.pageSlug, "svg");
}

/** True when the URL points at a generated SEO image belonging to a different page. */
function imageUrlBelongsToAnotherSeoPage(
  url: string,
  page: SeoPageRow,
): boolean {
  const ownKey = ownSeoImageStorageKey(page);
  const decoded = decodeURIComponent(url);
  const mentionsSeoStorage =
    decoded.includes("seo/") ||
    url.includes("seo%2F") ||
    url.includes("seo%2f");
  if (!mentionsSeoStorage) return false;
  return !decoded.includes(ownKey) && !url.includes(encodeURIComponent(ownKey));
}

/** True when imageAlt text semantically matches this page's subject (not another category). */
function imageAltMatchesPageSubject(page: SeoPageRow): boolean {
  const { categorySlug } = parsePageLocation(page);
  const subject = extractPageSubjectLabel(page, categorySlug).toLowerCase();
  const alt = (page.imageAlt || "").toLowerCase();
  if (!subject || !alt) return true;

  const subjectPhrase = subject.replace(/\s+in\s+.+$/, "").trim();
  if (subjectPhrase && alt.includes(subjectPhrase)) return true;

  const significant = subjectPhrase
    .split(/\s+/)
    .filter((w) => w.length > 3 && w !== "escorts" && w !== "services");
  if (significant.length > 0) {
    return significant.some((w) => alt.includes(w));
  }

  return subjectPhrase.split(/\s+/).some((w) => w.length > 2 && alt.includes(w));
}

/**
 * A featured image is valid when present, not copied from another SEO page,
 * and semantically aligned with this page's title/H1/category.
 */
export async function isFeaturedImageValid(page: SeoPageRow): Promise<boolean> {
  const url = page.featuredImage?.trim();
  if (!url) return false;

  if (url === SEO_IMAGE_PLACEHOLDER || url.endsWith(SEO_IMAGE_PLACEHOLDER)) {
    return imageAltMatchesPageSubject(page);
  }

  if (imageUrlBelongsToAnotherSeoPage(url, page)) return false;

  const ownKey = ownSeoImageStorageKey(page);
  if (url.includes(ownKey) || decodeURIComponent(url).includes(ownKey)) {
    return imageAltMatchesPageSubject(page);
  }

  const categoryIcon = await findCategoryFallbackImage(page);
  if (categoryIcon && url === categoryIcon) {
    return imageAltMatchesPageSubject(page);
  }

  const listingImage = await findListingImageForPage(page);
  if (listingImage && url === listingImage) {
    return imageAltMatchesPageSubject(page);
  }

  if (!imageAltMatchesPageSubject(page)) return false;

  return true;
}

async function findListingImageForPage(page: SeoPageRow): Promise<string | null> {
  const { citySlug, categorySlug } = parsePageLocation(page);
  if (!citySlug) return null;

  const listing = await db.listing.findFirst({
    where: {
      status: "approved",
      citySlug,
      ...(categorySlug ? { categorySlug } : {}),
      OR: [
        { profileImage: { not: null } },
        {
          listingImages: {
            some: { moderationStatus: "approved" },
          },
        },
      ],
    },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    select: {
      profileImage: true,
      listingImages: {
        where: { moderationStatus: "approved" },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true, mediumUrl: true },
      },
    },
  });

  if (!listing) return null;
  const fromDb = listing.listingImages[0]?.mediumUrl || listing.listingImages[0]?.url;
  if (fromDb?.trim()) return fromDb.trim();
  if (listing.profileImage?.trim()) return listing.profileImage.trim();
  return null;
}

async function findCategoryFallbackImage(page: SeoPageRow): Promise<string | null> {
  let slug: string | null = null;
  if (page.pageType === "category") {
    slug = page.pageSlug;
  } else {
    slug = parsePageLocation(page).categorySlug;
  }
  if (!slug) return null;

  const category = await db.category.findFirst({
    where: { slug },
    select: { icon: true },
  });
  return category?.icon?.trim() || null;
}

export interface ResolvedFeaturedImage {
  url: string;
  imageAlt: string;
  imageTitle: string;
  imageCaption: string;
  source: "listing" | "category" | "generated" | "placeholder";
}

/**
 * Resolve a featured image for THIS page only.
 * Priority: matching listing (same category+city) → category icon → page-specific SVG → placeholder.
 * Never copies images from another SEO page.
 */
export async function resolveFeaturedImageForPage(
  page: SeoPageRow,
): Promise<ResolvedFeaturedImage> {
  const copy = await buildPageSpecificImageCopy(page);

  const listingImage = await findListingImageForPage(page);
  if (listingImage) {
    return {
      url: listingImage,
      imageAlt: copy.imageAlt,
      imageTitle: copy.imageTitle,
      imageCaption: copy.imageCaption,
      source: "listing",
    };
  }

  const categoryImage = await findCategoryFallbackImage(page);
  if (categoryImage) {
    return {
      url: categoryImage,
      imageAlt: copy.imageAlt,
      imageTitle: copy.imageTitle,
      imageCaption: copy.imageCaption,
      source: "category",
    };
  }

  try {
    const generated = await generateAndStoreSeoImage({
      pageType: page.pageType,
      pageSlug: page.pageSlug,
      headline: copy.headline,
      subtitle: copy.subtitle,
    });
    if (generated.featuredImage?.trim()) {
      return {
        url: generated.featuredImage.trim(),
        imageAlt: generated.imageAlt ?? copy.imageAlt,
        imageTitle: generated.imageTitle ?? copy.imageTitle,
        imageCaption: generated.imageCaption ?? copy.imageCaption,
        source: "generated",
      };
    }
  } catch {
    // fall through to static placeholder
  }

  return {
    url: SEO_IMAGE_PLACEHOLDER,
    imageAlt: copy.imageAlt,
    imageTitle: copy.imageTitle,
    imageCaption: copy.imageCaption,
    source: "placeholder",
  };
}

async function applyAssignImage(
  page: SeoPageRow,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (await isFeaturedImageValid(page)) {
    return { ok: true, skipped: true };
  }

  const resolved = await resolveFeaturedImageForPage(page);
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";
  const pageUrl = `${siteOrigin.replace(/\/+$/, "")}${page.canonicalUrl || ""}`;
  const absoluteImage = resolveSeoImageUrl(resolved.url, siteOrigin);
  const customData = enrichSchemaWithFeaturedImage(
    page.customData,
    absoluteImage,
    resolved.imageAlt,
    pageUrl,
  );

  await db.seoPage.update({
    where: { id: page.id },
    data: {
      featuredImage: resolved.url,
      imageAlt: resolved.imageAlt,
      imageTitle: resolved.imageTitle,
      imageCaption: resolved.imageCaption,
      customData,
    },
  });

  return { ok: true };
}

async function applyRepairCanonical(page: SeoPageRow): Promise<{ ok: boolean; error?: string }> {
  const built = await buildRegeneratedContent(page.pageType, page.pageSlug, {
    ignoreExistingCanonical: true,
  });
  if (!built?.canonicalUrl) {
    return { ok: false, error: "Could not resolve canonical URL" };
  }

  await db.seoPage.update({
    where: { id: page.id },
    data: { canonicalUrl: built.canonicalUrl },
  });
  return { ok: true };
}

async function applyRepairBrokenLinks(page: SeoPageRow): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!page.introContent?.trim()) {
    return { ok: true, skipped: true };
  }
  const sanitized = await sanitizeStoredIntroContent(
    page.introContent,
    page.pageType,
    page.pageSlug,
  );
  if (sanitized === page.introContent) {
    return { ok: true, skipped: true };
  }
  await db.seoPage.update({
    where: { id: page.id },
    data: { introContent: sanitized },
  });
  return { ok: true };
}

async function applyRepairSchema(page: SeoPageRow): Promise<{ ok: boolean; error?: string }> {
  const built = await buildRegeneratedContent(page.pageType, page.pageSlug);
  if (!built) return { ok: false, error: "Could not build content for schema" };

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";
  const pageUrl = `${siteOrigin.replace(/\/+$/, "")}${built.canonicalUrl}`;
  const absoluteImage = resolveSeoImageUrl(page.featuredImage, siteOrigin);
  const customData = enrichSchemaWithFeaturedImage(
    buildSchemaJson(built.content, pageUrl),
    absoluteImage,
    page.imageAlt || built.content.h1,
    pageUrl,
  );

  await db.seoPage.update({
    where: { id: page.id },
    data: { customData },
  });
  return { ok: true };
}

async function applyRegenerateStrategy(
  pageId: string,
  createdBy?: { id: string; email: string },
): Promise<{ ok: boolean; error?: string }> {
  const result = await regenerateSeoPageById(pageId, createdBy);
  if (!result.ok) return { ok: false, error: result.error ?? "Regeneration failed" };
  return { ok: true };
}

async function applyDuplicateFallback(
  pageId: string,
  issueType: AutoFixIssueType,
): Promise<boolean> {
  if (issueType === "duplicate_titles") {
    const r = await autoFixDuplicateFields([pageId], "title");
    return r.changed > 0;
  }
  if (issueType === "duplicate_meta") {
    const r = await autoFixDuplicateFields([pageId], "metaDescription");
    return r.changed > 0;
  }
  if (issueType === "duplicate_h1") {
    const r = await autoFixDuplicateFields([pageId], "h1");
    return r.changed > 0;
  }
  return false;
}

async function applyStrategy(
  page: SeoPageRow,
  strategy: AutoFixStrategy,
  issueType: AutoFixIssueType,
  createdBy?: { id: string; email: string },
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  switch (strategy) {
    case "regenerate": {
      const regen = await applyRegenerateStrategy(page.id, createdBy);
      if (!regen.ok) return regen;
      if (issueType.startsWith("duplicate_")) {
        const still = await pageHasIssue(page, issueType);
        if (still) {
          await applyDuplicateFallback(page.id, issueType);
        }
      }
      return { ok: true };
    }
    case "repair_canonical":
      return applyRepairCanonical(page);
    case "repair_schema":
      return applyRepairSchema(page);
    case "assign_image":
      return applyAssignImage(page);
    case "repair_broken_links":
      return applyRepairBrokenLinks(page);
    default:
      return { ok: false, error: "Unknown strategy" };
  }
}

function buildResultMessage(changed: number, skipped: number, failed: number): string {
  if (changed === 0 && failed === 0) return "No fixes were necessary.";
  const parts: string[] = [];
  if (changed > 0) parts.push(`fixed ${changed}`);
  if (skipped > 0) parts.push(`skipped ${skipped}`);
  if (failed > 0) parts.push(`failed ${failed}`);
  return `Auto Fix complete: ${parts.join(", ")}.`;
}

/**
 * Universal Auto Fix — routes each issue type to the best repair strategy,
 * processes pages individually, and reports real changed/skipped/failed counts.
 */
export async function runUniversalAutoFix(input: {
  pageIds: string[];
  issueType: string;
  createdBy?: { id: string; email: string };
}): Promise<UniversalAutoFixResult> {
  const strategy = resolveAutoFixStrategy(input.issueType);
  const result: UniversalAutoFixResult = {
    processed: 0,
    changed: 0,
    skipped: 0,
    failed: 0,
    strategy: strategy ?? "regenerate",
    details: [],
    message: "No fixes were necessary.",
  };

  if (!strategy || input.pageIds.length === 0) {
    result.message = input.pageIds.length === 0 ? "No pages selected." : "Unsupported issue type.";
    return result;
  }

  console.log("AUTO_FIX_START", {
    issueType: input.issueType,
    strategy,
    pageCount: input.pageIds.length,
  });

  const pages = await db.seoPage.findMany({
    where: { id: { in: input.pageIds } },
    select: PAGE_SELECT,
  });

  const byId = new Map(pages.map((p) => [p.id, p]));

  for (const pageId of input.pageIds) {
    result.processed++;
    const page = byId.get(pageId);
    if (!page) {
      result.failed++;
      result.details.push({
        pageId,
        pageSlug: "unknown",
        status: "failed",
        strategy,
        reason: "Page not found",
      });
      console.log("AUTO_FIX_FAILED", pageId, "Page not found");
      continue;
    }

    console.log("AUTO_FIX_PAGE", {
      pageId: page.id,
      pageSlug: page.pageSlug,
      issueType: input.issueType,
      strategy,
    });

    const routeCheck = await isSeoPageRoutable({
      pageType: page.pageType,
      pageSlug: page.pageSlug,
      canonicalUrl: page.canonicalUrl,
    });
    if (!routeCheck.routable) {
      result.skipped++;
      result.details.push({
        pageId: page.id,
        pageSlug: page.pageSlug,
        status: "skipped",
        strategy,
        reason: routeCheck.reason ?? "Page has no valid public route",
      });
      console.log("AUTO_FIX_SKIP_UNROUTABLE", page.id, routeCheck.reason);
      continue;
    }

    const hadIssue = await pageHasIssue(page, input.issueType);
    if (!hadIssue) {
      result.skipped++;
      result.details.push({
        pageId: page.id,
        pageSlug: page.pageSlug,
        status: "skipped",
        strategy,
        reason: "Issue already resolved",
      });
      console.log("AUTO_FIX_SKIP", page.id, "Issue already resolved");
      continue;
    }

    const before = snapshot(page);

    try {
      const applied = await applyStrategy(
        page,
        strategy,
        input.issueType as AutoFixIssueType,
        input.createdBy,
      );

      if (!applied.ok) {
        result.failed++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "failed",
          strategy,
          reason: applied.error,
        });
        console.log("AUTO_FIX_FAILED", page.id, applied.error);
        continue;
      }

      if (applied.skipped) {
        result.skipped++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "skipped",
          strategy,
          reason: "Image already valid",
        });
        console.log("AUTO_FIX_SKIP", page.id, "Image already valid");
        continue;
      }

      const afterPage = await db.seoPage.findUnique({
        where: { id: page.id },
        select: PAGE_SELECT,
      });
      if (!afterPage) {
        result.failed++;
        console.log("AUTO_FIX_FAILED", page.id, "Page missing after update");
        continue;
      }

      const after = snapshot(afterPage);
      const stillHasIssue = await pageHasIssue(afterPage, input.issueType);
      const introChanged =
        strategy === "repair_broken_links" &&
        afterPage.introContent !== page.introContent;
      const dataChanged = !snapshotsEqual(before, after) || introChanged;
      const actualWords = calculateVisibleWordCount(afterPage.introContent);
      const actualLinks = calculateInternalLinksCount(afterPage.introContent);
      const thinContentFailed =
        input.issueType === "thin_content" && actualWords < SEO_MIN_WORD_COUNT;
      const internalLinksFailed =
        input.issueType === "missing_internal_links" &&
        actualLinks < MIN_INTERNAL_LINKS_PER_PAGE;
      const hashChanged = before.contentHash !== after.contentHash;
      const computedHash = computeContentHash(afterPage.introContent);
      const hashStale = afterPage.contentHash !== computedHash;
      const duplicateIssueFailed =
        input.issueType.startsWith("duplicate_") &&
        stillHasIssue &&
        !hashChanged;

      if (duplicateIssueFailed) {
        result.failed++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "failed",
          strategy,
          reason: `Duplicate issue unchanged after ${strategy}${hashStale ? " (contentHash not synced to intro)" : ""}`,
        });
        console.log("AUTO_FIX_FAILED", page.id, `${input.issueType}: duplicate unchanged`);
        continue;
      }

      if (internalLinksFailed) {
        result.failed++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "failed",
          strategy,
          reason: `Internal link count ${actualLinks} still below ${MIN_INTERNAL_LINKS_PER_PAGE} after ${strategy}`,
        });
        console.log("AUTO_FIX_FAILED", page.id, `missing_internal_links: ${actualLinks} links`);
        continue;
      }

      if (thinContentFailed) {
        result.failed++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "failed",
          strategy,
          reason: `Word count ${actualWords} still below ${SEO_MIN_WORD_COUNT} after ${strategy}`,
        });
        console.log("AUTO_FIX_FAILED", page.id, `thin_content: ${actualWords} words`);
        continue;
      }

      if (dataChanged && !stillHasIssue) {
        result.changed++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "changed",
          strategy,
        });
        console.log("AUTO_FIX_SUCCESS", page.id, input.issueType);
      } else if (dataChanged) {
        result.changed++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "changed",
          strategy,
          reason: "Partial improvement",
        });
        console.log("AUTO_FIX_SUCCESS", page.id, "partial");
      } else if (!stillHasIssue) {
        result.skipped++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "skipped",
          strategy,
          reason: "Already resolved",
        });
        console.log("AUTO_FIX_SKIP", page.id, "Already resolved after run");
      } else {
        result.skipped++;
        result.details.push({
          pageId: page.id,
          pageSlug: page.pageSlug,
          status: "skipped",
          strategy,
          reason: "No improvement possible",
        });
        console.log("AUTO_FIX_SKIP", page.id, "No improvement possible");
      }
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : "Unknown error";
      result.details.push({
        pageId: page.id,
        pageSlug: page.pageSlug,
        status: "failed",
        strategy,
        reason: msg,
      });
      console.log("AUTO_FIX_FAILED", page.id, msg);
    }
  }

  clearRegenerationCaches();

  result.message = buildResultMessage(result.changed, result.skipped, result.failed);

  console.log("AUTO_FIX_FINISH", {
    issueType: input.issueType,
    processed: result.processed,
    changed: result.changed,
    skipped: result.skipped,
    failed: result.failed,
  });

  return result;
}
