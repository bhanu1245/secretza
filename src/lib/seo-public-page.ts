import { db } from "@/lib/db";
import type { Listing } from "@/lib/types";
import { buildLongtailCityFallbackFields, titleCaseFromSlug } from "@/lib/seo-fallback";
import { finalizeRelatedLinks, normalizeBreadcrumbItems, normalizeRelatedLinks } from "@/lib/seo-internal-links";
import { brandTitleSuffix } from "@/lib/brand";

export const TWO_SEGMENT_SEO_TYPES = ["longtail", "category_city"] as const;
export type TwoSegmentSeoType = (typeof TWO_SEGMENT_SEO_TYPES)[number];

export type PublishedSeoPage = {
  id: string;
  pageType: string;
  pageSlug: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  introContent: string | null;
  canonicalUrl: string | null;
  featuredImage: string | null;
  imageAlt: string | null;
  imageTitle: string | null;
  imageCaption: string | null;
  noindex: boolean;
  isPublished: boolean;
  customData: string | null;
  faqs: Array<{ question: string; answer: string }>;
};

/** Build the public path for an SEO page record. */
export function getSeoPagePublicUrl(page: {
  pageType: string;
  pageSlug: string;
  canonicalUrl?: string | null;
}): string {
  const canonical = page.canonicalUrl?.trim();
  if (canonical) {
    if (canonical.startsWith("http")) {
      try {
        return new URL(canonical).pathname;
      } catch {
        return canonical;
      }
    }
    return canonical.startsWith("/") ? canonical : `/${canonical}`;
  }

  if (page.pageType === "longtail" || page.pageType === "category_city") {
    return `/${page.pageSlug}`;
  }

  if (page.pageType === "category") {
    return `/category/${page.pageSlug}`;
  }

  if (page.pageType === "country") {
    return `/country/${page.pageSlug}`;
  }

  return `/${page.pageSlug}`;
}

export function buildTwoSegmentPageSlug(countrySlug: string, stateSlug: string): string {
  return `${countrySlug}/${stateSlug}`;
}

/** Parse JSON-LD blocks stored in SeoPage.customData. */
export function parseSeoPageSchemas(customData: string | null | undefined): object[] {
  if (!customData?.trim()) return [];
  try {
    const parsed = JSON.parse(customData) as { schemas?: object[] };
    return Array.isArray(parsed.schemas) ? parsed.schemas : [];
  } catch {
    return [];
  }
}

/** Load a published two-segment SEO page (longtail or category+city). */
export async function findPublishedTwoSegmentSeoPage(
  countrySlug: string,
  stateSlug: string,
): Promise<(PublishedSeoPage & { pageType: TwoSegmentSeoType }) | null> {
  const pageSlug = buildTwoSegmentPageSlug(countrySlug, stateSlug);

  for (const pageType of TWO_SEGMENT_SEO_TYPES) {
    const page = await db.seoPage.findUnique({
      where: { pageType_pageSlug: { pageType, pageSlug } },
      include: {
        faqs: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { question: true, answer: true },
        },
      },
    });

    if (page?.isPublished) {
      return { ...page, pageType };
    }
  }

  return null;
}

const listingInclude = {
  user: { select: { id: true, name: true, image: true, isVerified: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
  country: { select: { id: true, name: true, slug: true } },
  state: { select: { id: true, name: true, slug: true } },
  city: { select: { id: true, name: true, slug: true } },
  listingImages: {
    where: { moderationStatus: "approved" as const },
    orderBy: { sortOrder: "asc" as const },
    take: 1,
  },
  _count: { select: { reviews: true } },
};

function serializeListing(l: {
  id: string;
  title: string;
  slug: string;
  description: string;
  tags: string;
  price: string;
  currency: string;
  status: string;
  isFeatured: boolean;
  isBoosted: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null; image: string | null; isVerified: boolean } | null;
  category: { id: string; name: string; slug: string; color: string };
  country: { id: string; name: string; slug: string };
  state: { id: string; name: string; slug: string } | null;
  city: { id: string; name: string; slug: string };
  listingImages: Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    mediumUrl: string;
    width: number;
    height: number;
    sortOrder: number;
    blurHash: string | null;
  }>;
  _count: { reviews: number };
}): Listing {
  let tags: string[] = [];
  try {
    tags = JSON.parse(l.tags || "[]");
  } catch {
    tags = [];
  }

  return {
    id: l.id,
    title: l.title,
    slug: l.slug,
    description: l.description,
    tags,
    price: l.price,
    currency: l.currency,
    contact: {},
    status: l.status as Listing["status"],
    isFeatured: l.isFeatured,
    isBoosted: l.isBoosted,
    isPremium: (l as any).isPremium ?? false,
    featuredUntil: null,
    boostUntil: null,
    lastBumpedAt: null,
    priorityScore: 0,
    expiresAt: null,
    viewCount: l.viewCount,
    createdAt: l.createdAt.toISOString(),
    user: {
      id: l.user?.id || "",
      name: l.user?.name || "Unknown user",
      avatar: l.user?.image || null,
    },
    category: l.category as Listing["category"],
    country: l.country as Listing["country"],
    state: (l.state || {
      id: "",
      name: "",
      slug: "",
      countryId: "",
      isActive: true,
      listingCount: 0,
    }) as Listing["state"],
    city: l.city as Listing["city"],
    images: [],
    listingImages: l.listingImages as Listing["listingImages"],
    reviewCount: l._count.reviews,
  };
}

export async function fetchListingsForTwoSegmentSeoPage(
  pageType: TwoSegmentSeoType,
  countrySlug: string,
  stateSlug: string,
): Promise<Listing[]> {
  const citySlug = stateSlug;

  if (pageType === "category_city") {
    const rows = await db.listing.findMany({
      where: {
        citySlug,
        OR: [
          { categorySlug: countrySlug },
          { subcategorySlug: countrySlug },
        ],
        status: "approved",
      },
      include: listingInclude,
      orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
      take: 24,
    });
    return rows.map((l) => serializeListing(l as Parameters<typeof serializeListing>[0]));
  }

  const keyword = countrySlug.replace(/-/g, " ");
  const rows = await db.listing.findMany({
    where: {
      citySlug,
      status: "approved",
      OR: [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { tags: { contains: keyword } },
        { categorySlug: { contains: countrySlug } },
      ],
    },
    include: listingInclude,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 24,
  });

  if (rows.length > 0) {
    return rows.map((l) => serializeListing(l as Parameters<typeof serializeListing>[0]));
  }

  const fallbackRows = await db.listing.findMany({
    where: { citySlug, status: "approved" },
    include: listingInclude,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 24,
  });

  return fallbackRows.map((l) => serializeListing(l as Parameters<typeof serializeListing>[0]));
}

export type SeoBreadcrumbItem = { label: string; href?: string };

export type SeoRelatedLink = {
  title: string;
  href: string;
  group: "city" | "category" | "longtail";
};

function normalizePublicHref(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith("http")) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed;
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Extract breadcrumb trail from stored JSON-LD when available. */
export function extractBreadcrumbsFromSchema(
  customData: string | null | undefined,
): SeoBreadcrumbItem[] {
  const schemas = parseSeoPageSchemas(customData);
  for (const schema of schemas) {
    const record = schema as {
      "@type"?: string;
      itemListElement?: Array<{
        name?: string;
        item?: string | { name?: string; "@id"?: string };
      }>;
    };
    if (record["@type"] !== "BreadcrumbList" || !Array.isArray(record.itemListElement)) {
      continue;
    }

    const items = record.itemListElement
      .map((element) => {
        const label =
          (typeof element.item === "object" ? element.item?.name : undefined) ||
          element.name ||
          "";
        const href =
          typeof element.item === "string"
            ? normalizePublicHref(element.item)
            : normalizePublicHref(element.item?.["@id"]);
        return label ? { label, href } : null;
      })
      .filter(Boolean) as SeoBreadcrumbItem[];

    if (items.length > 0) {
      const last = items[items.length - 1];
      if (last) delete last.href;
      return items;
    }
  }

  return [];
}

export async function buildSeoPublicBreadcrumbs(
  page: PublishedSeoPage,
  countrySlug: string,
  stateSlug: string,
): Promise<SeoBreadcrumbItem[]> {
  const fromSchema = extractBreadcrumbsFromSchema(page.customData);
  if (fromSchema.length > 0) return fromSchema;

  const city = await db.city.findFirst({
    where: { slug: stateSlug, isActive: true },
    include: { state: { include: { country: true } } },
  });

  const items: SeoBreadcrumbItem[] = [{ label: "Home", href: "/" }];

  if (page.pageType === "category_city") {
    const category = await db.category.findFirst({
      where: { slug: countrySlug, isActive: true },
      select: { name: true, slug: true },
    });
    if (category) {
      items.push({ label: category.name, href: `/category/${category.slug}` });
    }
    if (city?.state?.country) {
      items.push({
        label: city.name,
        href: `/${city.state.country.slug}/${city.state.slug}/${city.slug}`,
      });
    }
    items.push({ label: page.h1 || page.title || `${category?.name || countrySlug} in ${city?.name || stateSlug}` });
    return items;
  }

  const keywordLabel = titleCaseFromSlug(countrySlug);
  if (city?.state?.country) {
    items.push({
      label: city.state.country.name,
      href: `/country/${city.state.country.slug}`,
    });
    items.push({
      label: city.state.name,
      href: `/${city.state.country.slug}/${city.state.slug}`,
    });
    items.push({
      label: city.name,
      href: `/${city.state.country.slug}/${city.state.slug}/${city.slug}`,
    });
  }
  items.push({
    label: page.h1 || page.title || `${keywordLabel} in ${city?.name || titleCaseFromSlug(stateSlug)}`,
  });
  return items;
}

export async function fetchRelatedSeoLinks(
  pageType: TwoSegmentSeoType,
  countrySlug: string,
  stateSlug: string,
): Promise<SeoRelatedLink[]> {
  const citySlug = stateSlug;
  const pageSlug = buildTwoSegmentPageSlug(countrySlug, stateSlug);
  const links: SeoRelatedLink[] = [];
  const seen = new Set<string>();

  const addLink = (link: SeoRelatedLink) => {
    if (seen.has(link.href) || link.href === `/${pageSlug}`) return;
    seen.add(link.href);
    links.push(link);
  };

  if (pageType === "longtail") {
    const keywordPages = await db.seoPage.findMany({
      where: {
        pageType: "longtail",
        isPublished: true,
        pageSlug: { startsWith: `${countrySlug}/` },
      },
      select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
      take: 12,
    });

    for (const row of keywordPages) {
      addLink({
        title: row.h1 || row.title || row.pageSlug.replace("/", " · "),
        href: getSeoPagePublicUrl({ ...row, pageType: "longtail" }),
        group: "longtail",
      });
    }

    const categoryCityPages = await db.seoPage.findMany({
      where: {
        pageType: "category_city",
        isPublished: true,
        pageSlug: { endsWith: `/${citySlug}` },
      },
      select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
      take: 8,
    });

    for (const row of categoryCityPages) {
      addLink({
        title: row.h1 || row.title || row.pageSlug.replace("/", " · "),
        href: getSeoPagePublicUrl({ ...row, pageType: "category_city" }),
        group: "category",
      });
    }
  } else {
    const categoryCityPages = await db.seoPage.findMany({
      where: {
        pageType: "category_city",
        isPublished: true,
        pageSlug: { endsWith: `/${citySlug}` },
      },
      select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
      take: 10,
    });

    for (const row of categoryCityPages) {
      addLink({
        title: row.h1 || row.title || row.pageSlug.replace("/", " · "),
        href: getSeoPagePublicUrl({ ...row, pageType: "category_city" }),
        group: "category",
      });
    }

    const longtailPages = await db.seoPage.findMany({
      where: {
        pageType: "longtail",
        isPublished: true,
        pageSlug: { endsWith: `/${citySlug}` },
      },
      select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
      take: 8,
    });

    for (const row of longtailPages) {
      addLink({
        title: row.h1 || row.title || row.pageSlug.replace("/", " · "),
        href: getSeoPagePublicUrl({ ...row, pageType: "longtail" }),
        group: "longtail",
      });
    }
  }

  const city = await db.city.findFirst({
    where: { slug: citySlug, isActive: true },
    include: { state: { include: { country: true } } },
  });

  if (city?.state?.country) {
    addLink({
      title: `All listings in ${city.name}`,
      href: `/${city.state.country.slug}/${city.state.slug}/${city.slug}`,
      group: "city",
    });
  }

  const nearbyCities = await db.city.findMany({
    where: {
      isActive: true,
      slug: { not: citySlug },
      stateId: city?.stateId,
    },
    orderBy: { listingCount: "desc" },
    take: 6,
    select: { slug: true, name: true },
  });

  for (const nearby of nearbyCities) {
    addLink({
      title: `${titleCaseFromSlug(countrySlug)} in ${nearby.name}`,
      href: `/${countrySlug}/${nearby.slug}`,
      group: "city",
    });
  }

  return finalizeRelatedLinks(links, {
    currentPath: `/${pageSlug}`,
    pageType,
    pageSlug,
    keywordSlug: pageType === "longtail" ? countrySlug : undefined,
    categorySlug: pageType === "category_city" ? countrySlug : undefined,
    citySlug,
    cityName: city?.name,
    stateId: city?.stateId,
    countrySlug: city?.state?.country?.slug,
    stateSlug: city?.state?.slug,
  });
}

export type SeoPageViewModel = {
  page: PublishedSeoPage;
  listings: Listing[];
  breadcrumbs: SeoBreadcrumbItem[];
  relatedLinks: SeoRelatedLink[];
};

/** Normalize breadcrumb + related link hrefs before render. */
export async function finalizeSeoPageViewModel(view: SeoPageViewModel): Promise<SeoPageViewModel> {
  const [breadcrumbs, relatedLinks] = await Promise.all([
    normalizeBreadcrumbItems(view.breadcrumbs),
    normalizeRelatedLinks(view.relatedLinks),
  ]);
  return { ...view, breadcrumbs, relatedLinks };
}

function createSyntheticSeoPage(
  pageType: string,
  pageSlug: string,
  fallback: {
    h1: string;
    title?: string;
    introContent?: string | null;
    canonicalUrl?: string;
  },
): PublishedSeoPage {
  return {
    id: `synthetic-${pageType}-${pageSlug}`,
    pageType,
    pageSlug,
    title: fallback.title ?? fallback.h1,
    metaDescription: null,
    h1: fallback.h1,
    introContent: fallback.introContent ?? null,
    canonicalUrl: fallback.canonicalUrl ?? null,
    featuredImage: null,
    imageAlt: null,
    imageTitle: null,
    imageCaption: null,
    noindex: false,
    isPublished: false,
    customData: null,
    faqs: [],
  };
}

/** Load SEO page record for public rendering (published or draft overrides). */
export async function resolveSeoPageForView(
  pageType: string,
  pageSlug: string,
  fallback: {
    h1: string;
    title?: string;
    introContent?: string | null;
    canonicalUrl?: string;
  },
): Promise<PublishedSeoPage> {
  const row = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
    include: {
      faqs: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { question: true, answer: true },
      },
    },
  });

  if (!row) {
    return createSyntheticSeoPage(pageType, pageSlug, fallback);
  }

  return {
    id: row.id,
    pageType: row.pageType,
    pageSlug: row.pageSlug,
    title: row.title ?? fallback.title ?? null,
    metaDescription: row.metaDescription,
    h1: row.h1 ?? fallback.h1,
    introContent: row.introContent ?? fallback.introContent ?? null,
    canonicalUrl: row.canonicalUrl ?? fallback.canonicalUrl ?? null,
    featuredImage: row.featuredImage,
    imageAlt: row.imageAlt,
    imageTitle: row.imageTitle,
    imageCaption: row.imageCaption,
    noindex: row.noindex,
    isPublished: row.isPublished,
    customData: row.customData,
    faqs: row.faqs,
  };
}

export async function fetchListingsForCityPage(cityId: string): Promise<Listing[]> {
  const rows = await db.listing.findMany({
    where: { cityId, status: "approved" },
    include: listingInclude,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 24,
  });
  return rows.map((l) => serializeListing(l as Parameters<typeof serializeListing>[0]));
}

export async function fetchListingsForStatePage(
  countrySlug: string,
  stateSlug: string,
): Promise<Listing[]> {
  const rows = await db.listing.findMany({
    where: { countrySlug, stateSlug, status: "approved" },
    include: listingInclude,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 24,
  });
  return rows.map((l) => serializeListing(l as Parameters<typeof serializeListing>[0]));
}

export async function fetchListingsForCountryPage(countrySlug: string): Promise<Listing[]> {
  const rows = await db.listing.findMany({
    where: { countrySlug, status: "approved" },
    include: listingInclude,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 24,
  });
  return rows.map((l) => serializeListing(l as Parameters<typeof serializeListing>[0]));
}

export async function fetchListingsForCategoryPage(
  categorySlug: string,
  categoryIds?: string[],
): Promise<Listing[]> {
  const where =
    categoryIds && categoryIds.length > 0
      ? {
          status: "approved" as const,
          OR: [
            { categoryId: { in: categoryIds } },
            { subcategoryId: { in: categoryIds } },
            { categorySlug },
            { subcategorySlug: categorySlug },
          ],
        }
      : {
          status: "approved" as const,
          OR: [{ categorySlug }, { subcategorySlug: categorySlug }],
        };

  const rows = await db.listing.findMany({
    where,
    include: listingInclude,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: 24,
  });
  return rows.map((l) => serializeListing(l as Parameters<typeof serializeListing>[0]));
}

function buildBreadcrumbsFromPageOrFallback(
  page: PublishedSeoPage,
  fallback: SeoBreadcrumbItem[],
): SeoBreadcrumbItem[] {
  const fromSchema = extractBreadcrumbsFromSchema(page.customData);
  return fromSchema.length > 0 ? fromSchema : fallback;
}

export async function fetchRelatedLinksForGeoCity(city: {
  slug: string;
  name: string;
  stateId: string;
  state: { slug: string; country: { slug: string; name: string } };
}): Promise<SeoRelatedLink[]> {
  const links: SeoRelatedLink[] = [];
  const seen = new Set<string>();
  const addLink = (link: SeoRelatedLink) => {
    if (seen.has(link.href)) return;
    seen.add(link.href);
    links.push(link);
  };

  const cityPath = `/${city.state.country.slug}/${city.state.slug}/${city.slug}`;
  addLink({
    title: `All listings in ${city.name}`,
    href: cityPath,
    group: "city",
  });

  const [longtailPages, categoryCityPages, nearbyCities, topCategories] = await Promise.all([
    db.seoPage.findMany({
      where: {
        pageType: "longtail",
        isPublished: true,
        pageSlug: { endsWith: `/${city.slug}` },
      },
      select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
      take: 8,
    }),
    db.seoPage.findMany({
      where: {
        pageType: "category_city",
        isPublished: true,
        pageSlug: { endsWith: `/${city.slug}` },
      },
      select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
      take: 8,
    }),
    db.city.findMany({
      where: { isActive: true, slug: { not: city.slug }, stateId: city.stateId },
      orderBy: { listingCount: "desc" },
      take: 6,
      select: { slug: true, name: true },
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { listingCount: "desc" },
      take: 6,
      select: { slug: true, name: true },
    }),
  ]);

  for (const row of longtailPages) {
    addLink({
      title: row.h1 || row.title || row.pageSlug.replace("/", " · "),
      href: getSeoPagePublicUrl({ ...row, pageType: "longtail" }),
      group: "longtail",
    });
  }

  for (const row of categoryCityPages) {
    addLink({
      title: row.h1 || row.title || row.pageSlug.replace("/", " · "),
      href: getSeoPagePublicUrl({ ...row, pageType: "category_city" }),
      group: "category",
    });
  }

  for (const cat of topCategories) {
    addLink({
      title: `${cat.name} in ${city.name}`,
      href: `/${cat.slug}/${city.slug}`,
      group: "category",
    });
  }

  for (const nearby of nearbyCities) {
    addLink({
      title: `Listings in ${nearby.name}`,
      href: `/${city.state.country.slug}/${city.state.slug}/${nearby.slug}`,
      group: "city",
    });
  }

  if (links.filter((l) => l.group === "city").length < 4) {
    const fallbackCities = await db.city.findMany({
      where: { isActive: true, slug: { not: city.slug } },
      orderBy: { listingCount: "desc" },
      take: 8,
      select: { slug: true, name: true, state: { select: { slug: true, country: { select: { slug: true } } } } },
    });
    for (const c of fallbackCities) {
      if (links.filter((l) => l.group === "city").length >= 6) break;
      if (!c.state?.country) continue;
      addLink({
        title: `Listings in ${c.name}`,
        href: `/${c.state.country.slug}/${c.state.slug}/${c.slug}`,
        group: "city",
      });
    }
  }

  return finalizeRelatedLinks(links, {
    currentPath: cityPath,
    pageType: "city",
    pageSlug: city.slug,
    citySlug: city.slug,
    cityName: city.name,
    stateId: city.stateId,
    countrySlug: city.state.country.slug,
    stateSlug: city.state.slug,
  });
}

export async function fetchRelatedLinksForGeoState(state: {
  slug: string;
  name: string;
  country: { slug: string; name: string };
  cities: Array<{ slug: string; name: string; listingCount: number }>;
}): Promise<SeoRelatedLink[]> {
  const links: SeoRelatedLink[] = [];
  const seen = new Set<string>();
  const addLink = (link: SeoRelatedLink) => {
    if (seen.has(link.href)) return;
    seen.add(link.href);
    links.push(link);
  };

  addLink({
    title: state.country.name,
    href: `/country/${state.country.slug}`,
    group: "city",
  });

  for (const city of state.cities.filter((c) => c.listingCount > 0).slice(0, 8)) {
    addLink({
      title: `Listings in ${city.name}`,
      href: `/${state.country.slug}/${state.slug}/${city.slug}`,
      group: "city",
    });
  }

  const cityPages = await db.seoPage.findMany({
    where: { pageType: "city", isPublished: true },
    select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
    take: 6,
  });

  for (const row of cityPages) {
    addLink({
      title: row.h1 || row.title || titleCaseFromSlug(row.pageSlug),
      href: getSeoPagePublicUrl({ ...row, pageType: "city" }),
      group: "longtail",
    });
  }

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { listingCount: "desc" },
    take: 6,
    select: { slug: true, name: true },
  });

  for (const cat of categories) {
    addLink({
      title: cat.name,
      href: `/category/${cat.slug}`,
      group: "category",
    });
  }

  return finalizeRelatedLinks(links, {
    currentPath: `/${state.country.slug}/${state.slug}`,
    pageType: "state",
    pageSlug: state.slug,
    countrySlug: state.country.slug,
    stateSlug: state.slug,
  });
}

export async function fetchRelatedLinksForGeoCountry(country: {
  slug: string;
  name: string;
  states: Array<{ slug: string; name: string; listingCount: number }>;
}): Promise<SeoRelatedLink[]> {
  const links: SeoRelatedLink[] = [];
  const seen = new Set<string>();
  const addLink = (link: SeoRelatedLink) => {
    if (seen.has(link.href)) return;
    seen.add(link.href);
    links.push(link);
  };

  for (const state of country.states.slice(0, 8)) {
    addLink({
      title: `Listings in ${state.name}`,
      href: `/${country.slug}/${state.slug}`,
      group: "city",
    });
  }

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { listingCount: "desc" },
    take: 8,
    select: { slug: true, name: true },
  });

  for (const cat of categories) {
    addLink({
      title: cat.name,
      href: `/category/${cat.slug}`,
      group: "category",
    });
  }

  const longtailPages = await db.seoPage.findMany({
    where: { pageType: "longtail", isPublished: true },
    select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
    take: 6,
  });

  for (const row of longtailPages) {
    addLink({
      title: row.h1 || row.title || row.pageSlug.replace("/", " · "),
      href: getSeoPagePublicUrl({ ...row, pageType: "longtail" }),
      group: "longtail",
    });
  }

  return finalizeRelatedLinks(links, {
    currentPath: `/country/${country.slug}`,
    pageType: "country",
    pageSlug: country.slug,
    countrySlug: country.slug,
  });
}

export async function fetchRelatedLinksForCategory(category: {
  slug: string;
  name: string;
}): Promise<SeoRelatedLink[]> {
  const links: SeoRelatedLink[] = [];
  const seen = new Set<string>();
  const addLink = (link: SeoRelatedLink) => {
    if (seen.has(link.href)) return;
    seen.add(link.href);
    links.push(link);
  };

  const [categoryCityPages, topCities, otherCategories] = await Promise.all([
    db.seoPage.findMany({
      where: {
        pageType: "category_city",
        isPublished: true,
        pageSlug: { startsWith: `${category.slug}/` },
      },
      select: { pageSlug: true, title: true, h1: true, canonicalUrl: true },
      take: 8,
    }),
    db.city.findMany({
      where: { isActive: true },
      orderBy: { listingCount: "desc" },
      take: 6,
      select: { slug: true, name: true },
    }),
    db.category.findMany({
      where: { isActive: true, slug: { not: category.slug } },
      orderBy: { listingCount: "desc" },
      take: 6,
      select: { slug: true, name: true },
    }),
  ]);

  for (const row of categoryCityPages) {
    addLink({
      title: row.h1 || row.title || row.pageSlug.replace("/", " · "),
      href: getSeoPagePublicUrl({ ...row, pageType: "category_city" }),
      group: "longtail",
    });
  }

  for (const city of topCities) {
    addLink({
      title: `${category.name} in ${city.name}`,
      href: `/${category.slug}/${city.slug}`,
      group: "city",
    });
  }

  for (const cat of otherCategories) {
    addLink({
      title: cat.name,
      href: `/category/${cat.slug}`,
      group: "category",
    });
  }

  return finalizeRelatedLinks(links, {
    currentPath: `/category/${category.slug}`,
    pageType: "category",
    pageSlug: category.slug,
    categorySlug: category.slug,
  });
}

export async function loadTwoSegmentSeoPageView(
  countrySlug: string,
  stateSlug: string,
): Promise<SeoPageViewModel | null> {
  const publishedSeo = await findPublishedTwoSegmentSeoPage(countrySlug, stateSlug);
  if (!publishedSeo) return null;

  const [listings, breadcrumbs, relatedLinks] = await Promise.all([
    fetchListingsForTwoSegmentSeoPage(publishedSeo.pageType, countrySlug, stateSlug),
    buildSeoPublicBreadcrumbs(publishedSeo, countrySlug, stateSlug),
    fetchRelatedSeoLinks(publishedSeo.pageType, countrySlug, stateSlug),
  ]);

  return finalizeSeoPageViewModel({ page: publishedSeo, listings, breadcrumbs, relatedLinks });
}

/** Fallback for /{keyword}/{city} when no published SEO record exists yet. */
export async function loadLongtailCityFallbackView(
  keywordSlug: string,
  citySlug: string,
): Promise<SeoPageViewModel | null> {
  const [realCountry, city] = await Promise.all([
    db.country.findFirst({ where: { slug: keywordSlug, isActive: true } }),
    db.city.findFirst({
      where: { slug: citySlug, isActive: true },
      include: { state: { include: { country: true } } },
    }),
  ]);

  if (!city || realCountry) return null;

  const fields = buildLongtailCityFallbackFields(keywordSlug, city.name, city.slug);
  const page = await resolveSeoPageForView("longtail", fields.pageSlug, {
    h1: fields.h1,
    title: fields.title,
    introContent: fields.metaDescription,
    canonicalUrl: fields.canonicalPath,
  });

  const [listings, breadcrumbs, relatedLinks] = await Promise.all([
    fetchListingsForTwoSegmentSeoPage("longtail", keywordSlug, citySlug),
    buildSeoPublicBreadcrumbs(page, keywordSlug, citySlug),
    fetchRelatedSeoLinks("longtail", keywordSlug, citySlug),
  ]);

  return finalizeSeoPageViewModel({ page, listings, breadcrumbs, relatedLinks });
}

export async function loadCategoryCityFallbackView(
  categorySlug: string,
  citySlug: string,
): Promise<SeoPageViewModel | null> {
  const [category, city] = await Promise.all([
    db.category.findFirst({ where: { slug: categorySlug, isActive: true } }),
    db.city.findFirst({
      where: { slug: citySlug, isActive: true },
      include: { state: { include: { country: true } } },
    }),
  ]);

  if (!category || !city) return null;

  const pageSlug = `${category.slug}/${city.slug}`;
  const page = await resolveSeoPageForView("category_city", pageSlug, {
    h1: `${category.name} in ${city.name}`,
    title: `${category.name} in ${city.name}`,
    canonicalUrl: `/${pageSlug}`,
  });

  const [listings, breadcrumbs, relatedLinks] = await Promise.all([
    fetchListingsForTwoSegmentSeoPage("category_city", categorySlug, citySlug),
    buildSeoPublicBreadcrumbs(page, categorySlug, citySlug),
    fetchRelatedSeoLinks("category_city", categorySlug, citySlug),
  ]);

  return finalizeSeoPageViewModel({ page, listings, breadcrumbs, relatedLinks });
}

export async function loadCitySeoPageView(
  countrySlug: string,
  stateSlug: string,
  citySlug: string,
): Promise<SeoPageViewModel | null> {
  const city = await db.city.findFirst({
    where: {
      slug: citySlug,
      isActive: true,
      state: { slug: stateSlug, country: { slug: countrySlug } },
    },
    include: { state: { include: { country: true } } },
  });

  if (!city) return null;

  const canonicalUrl = `/${countrySlug}/${stateSlug}/${citySlug}`;
  const page = await resolveSeoPageForView("city", citySlug, {
    h1: `Classifieds in ${city.name}, ${city.state.name}, ${city.state.country.name}`,
    title: `Classifieds in ${city.name}`,
    canonicalUrl,
  });

  const breadcrumbs = buildBreadcrumbsFromPageOrFallback(page, [
    { label: "Home", href: "/" },
    { label: city.state.country.name, href: `/country/${city.state.country.slug}` },
    { label: city.state.name, href: `/${countrySlug}/${stateSlug}` },
    { label: city.name },
  ]);

  const [listings, relatedLinks] = await Promise.all([
    fetchListingsForCityPage(city.id),
    fetchRelatedLinksForGeoCity(city),
  ]);

  return finalizeSeoPageViewModel({ page, listings, breadcrumbs, relatedLinks });
}

export async function loadStateSeoPageView(
  countrySlug: string,
  stateSlug: string,
): Promise<SeoPageViewModel | null> {
  const state = await db.state.findFirst({
    where: { slug: stateSlug, isActive: true, country: { slug: countrySlug } },
    include: {
      country: true,
      cities: {
        where: { isActive: true },
        orderBy: { listingCount: "desc" },
        select: { slug: true, name: true, listingCount: true },
      },
    },
  });

  if (!state) return null;

  const canonicalUrl = `/${countrySlug}/${stateSlug}`;
  const page = await resolveSeoPageForView("state", stateSlug, {
    h1: `Classifieds in ${state.name}, ${state.country.name}`,
    title: `Classifieds in ${state.name}`,
    canonicalUrl,
  });

  const breadcrumbs = buildBreadcrumbsFromPageOrFallback(page, [
    { label: "Home", href: "/" },
    { label: state.country.name, href: `/country/${state.country.slug}` },
    { label: state.name },
  ]);

  const [listings, relatedLinks] = await Promise.all([
    fetchListingsForStatePage(countrySlug, stateSlug),
    fetchRelatedLinksForGeoState(state),
  ]);

  return finalizeSeoPageViewModel({ page, listings, breadcrumbs, relatedLinks });
}

export async function loadCountrySeoPageView(slug: string): Promise<SeoPageViewModel | null> {
  const country = await db.country.findUnique({
    where: { slug },
    include: {
      states: {
        where: { isActive: true },
        orderBy: { listingCount: "desc" },
        select: { slug: true, name: true, listingCount: true },
      },
    },
  });

  if (!country || !country.isActive) return null;

  const canonicalUrl = `/country/${slug}`;
  const page = await resolveSeoPageForView("country", slug, {
    h1: `Classifieds in ${country.name}`,
    title: `Classifieds in ${country.name}`,
    canonicalUrl,
  });

  const breadcrumbs = buildBreadcrumbsFromPageOrFallback(page, [
    { label: "Home", href: "/" },
    { label: country.name },
  ]);

  const [listings, relatedLinks] = await Promise.all([
    fetchListingsForCountryPage(slug),
    fetchRelatedLinksForGeoCountry(country),
  ]);

  return finalizeSeoPageViewModel({ page, listings, breadcrumbs, relatedLinks });
}

export async function loadCategorySeoPageView(slug: string): Promise<SeoPageViewModel | null> {
  const category = await db.category.findFirst({
    where: { slug, isActive: true },
    include: {
      children: { where: { isActive: true }, select: { id: true } },
    },
  });

  if (!category) return null;

  const categoryIds = [category.id, ...category.children.map((child) => child.id)];
  const canonicalUrl = `/category/${slug}`;
  const page = await resolveSeoPageForView("category", slug, {
    h1: category.name,
    title: `${category.name}${brandTitleSuffix()}`,
    introContent: category.description,
    canonicalUrl,
  });

  const breadcrumbs = buildBreadcrumbsFromPageOrFallback(page, [
    { label: "Home", href: "/" },
    { label: category.name },
  ]);

  const [listings, relatedLinks] = await Promise.all([
    fetchListingsForCategoryPage(slug, categoryIds),
    fetchRelatedLinksForCategory(category),
  ]);

  return finalizeSeoPageViewModel({ page, listings, breadcrumbs, relatedLinks });
}
