/**
 * SEO page JSON-LD schema bundle — build, resolve at render time, and validate.
 */

import {
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateOrganizationSchema,
  generateWebPageSchema,
  generateWebSiteSchema,
  getCanonicalURL,
} from "@/lib/seo-content";
import { resolveSeoImageUrl, serializeSeoPageImages, buildImageObjectSchema } from "@/lib/seo-images";
import { getSeoPagePublicUrl, parseSeoPageSchemas, type SeoBreadcrumbItem } from "@/lib/seo-public-page";

export const REQUIRED_SEO_SCHEMA_TYPES = [
  "Organization",
  "WebSite",
  "WebPage",
  "BreadcrumbList",
  "FAQPage",
] as const;

export type RequiredSeoSchemaType = (typeof REQUIRED_SEO_SCHEMA_TYPES)[number];

export type SeoSchemaBuildInput = {
  title: string;
  metaDescription?: string | null;
  pageUrl: string;
  breadcrumbItems: Array<{ name: string; url: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  featuredImage?: string | null;
  imageAlt?: string | null;
};

function schemaTypeOf(schema: object): string | undefined {
  const record = schema as { "@type"?: string };
  return typeof record["@type"] === "string" ? record["@type"] : undefined;
}

function normalizeAbsoluteUrl(url: string, siteOrigin: string): string {
  const origin = siteOrigin.replace(/\/+$/, "");
  if (url.startsWith("http")) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${origin}${path}`;
}

/** Build the full SEO schema bundle for persistence or runtime render. */
export function buildSeoPageSchemaBundle(input: SeoSchemaBuildInput): object[] {
  const schemas: object[] = [
    generateOrganizationSchema(),
    generateWebSiteSchema(),
    generateWebPageSchema({
      name: input.title,
      description: input.metaDescription,
      url: input.pageUrl,
    }),
    generateBreadcrumbSchema(input.breadcrumbItems),
  ];

  if (input.faqs?.length) {
    schemas.push(generateFAQSchema(input.faqs));
  }

  const imageFields = serializeSeoPageImages({
    featuredImage: input.featuredImage,
    imageAlt: input.imageAlt,
    title: input.title,
    h1: input.title,
  });
  const absoluteImage = imageFields.featuredImage.startsWith("http")
    ? imageFields.featuredImage
    : `${(process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com").replace(/\/+$/, "")}${imageFields.featuredImage.startsWith("/") ? "" : "/"}${imageFields.featuredImage}`;

  schemas.push(
    buildImageObjectSchema({
      imageUrl: absoluteImage,
      imageAlt: imageFields.imageAlt,
      pageUrl: input.pageUrl,
    }),
  );

  return schemas;
}

function breadcrumbsToSchemaItems(
  breadcrumbs: SeoBreadcrumbItem[],
  pagePath: string,
): Array<{ name: string; url: string }> {
  return breadcrumbs.map((item, index) => ({
    name: item.label,
    url: item.href ?? (index === breadcrumbs.length - 1 ? pagePath : "/"),
  }));
}

export function resolvePageAbsoluteUrl(
  page: {
    canonicalUrl?: string | null;
    pageType: string;
    pageSlug: string;
  },
  siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com",
): string {
  const canonical = page.canonicalUrl?.trim();
  if (canonical) {
    return normalizeAbsoluteUrl(canonical, siteOrigin);
  }
  const path = getSeoPagePublicUrl(page);
  return normalizeAbsoluteUrl(path, siteOrigin);
}

/**
 * Merge stored customData schemas with runtime-generated gaps.
 * Ensures Organization, WebSite, WebPage, BreadcrumbList, and FAQPage (when FAQs exist).
 */
export function resolveSeoPageSchemasForView(input: {
  page: {
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
    pageType: string;
    pageSlug: string;
    canonicalUrl: string | null;
    customData: string | null;
    featuredImage: string | null;
    imageAlt: string | null;
    faqs: Array<{ question: string; answer: string }>;
  };
  breadcrumbs: SeoBreadcrumbItem[];
}): object[] {
  const { page, breadcrumbs } = input;
  const stored = parseSeoPageSchemas(page.customData);
  const pagePath = getSeoPagePublicUrl(page);
  const pageUrl = resolvePageAbsoluteUrl(page);
  const title = page.title || page.h1 || page.pageSlug;
  const runtime = buildSeoPageSchemaBundle({
    title,
    metaDescription: page.metaDescription,
    pageUrl,
    breadcrumbItems: breadcrumbsToSchemaItems(breadcrumbs, pagePath),
    faqs: page.faqs,
    featuredImage: page.featuredImage,
    imageAlt: page.imageAlt || page.h1 || page.title,
  });

  const merged = new Map<string, object>();
  for (const schema of stored) {
    const type = schemaTypeOf(schema);
    if (type) merged.set(type, schema);
  }
  for (const schema of runtime) {
    const type = schemaTypeOf(schema);
    if (!type) continue;
    if (type === "FAQPage" && page.faqs.length === 0) continue;
    if (!merged.has(type)) {
      merged.set(type, schema);
    }
  }

  // Always ensure ImageObject reflects current display image (incl. placeholder)
  const images = serializeSeoPageImages({
    featuredImage: page.featuredImage,
    imageAlt: page.imageAlt,
    title: page.title,
    h1: page.h1,
    pageType: page.pageType,
  });
  const absoluteImage = images.featuredImage.startsWith("http")
    ? images.featuredImage
    : normalizeAbsoluteUrl(images.featuredImage, process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com");
  merged.set(
    "ImageObject",
    buildImageObjectSchema({
      imageUrl: absoluteImage,
      imageAlt: images.imageAlt,
      pageUrl,
    }),
  );

  const order: string[] = [
    "Organization",
    "WebSite",
    "WebPage",
    "BreadcrumbList",
    "FAQPage",
    "ImageObject",
  ];
  const schemas = order
    .map((type) => merged.get(type))
    .filter(Boolean) as object[];

  for (const [type, schema] of merged) {
    if (!order.includes(type)) schemas.push(schema);
  }

  return schemas;
}

export type SeoSchemaValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type SeoSchemaValidationResult = {
  pass: boolean;
  schemaTypes: string[];
  issues: SeoSchemaValidationIssue[];
  checks: Record<RequiredSeoSchemaType | "ImageObject", boolean>;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function faqQuestionsFromSchema(schema: object): string[] {
  const record = schema as {
    mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>;
  };
  if (!Array.isArray(record.mainEntity)) return [];
  return record.mainEntity
    .map((q) => q.name?.trim())
    .filter(Boolean) as string[];
}

/** Validate resolved schemas against page metadata and visible FAQs. */
export function validateSeoPageSchemas(input: {
  schemas: object[];
  title: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  pageType: string;
  pageSlug: string;
  faqs: Array<{ question: string; answer: string }>;
}): SeoSchemaValidationResult {
  const issues: SeoSchemaValidationIssue[] = [];
  const schemaTypes = input.schemas.map((s) => schemaTypeOf(s)).filter(Boolean) as string[];
  const typeSet = new Set(schemaTypes);

  if (schemaTypes.length !== new Set(schemaTypes).size) {
    issues.push({
      code: "duplicate_schema",
      message: `Duplicate @type entries: ${schemaTypes.join(", ")}`,
      severity: "error",
    });
  }

  const checks: SeoSchemaValidationResult["checks"] = {
    Organization: typeSet.has("Organization"),
    WebSite: typeSet.has("WebSite"),
    WebPage: typeSet.has("WebPage"),
    BreadcrumbList: typeSet.has("BreadcrumbList"),
    FAQPage: input.faqs.length === 0 ? true : typeSet.has("FAQPage"),
    ImageObject: typeSet.has("ImageObject"),
  };

  for (const type of REQUIRED_SEO_SCHEMA_TYPES) {
    if (type === "FAQPage" && input.faqs.length === 0) continue;
    if (!checks[type]) {
      issues.push({
        code: "missing_schema",
        message: `Missing required schema: ${type}`,
        severity: "error",
      });
    }
  }

  const pageUrl = input.canonicalUrl?.trim()
    ? normalizeAbsoluteUrl(input.canonicalUrl, process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com")
    : resolvePageAbsoluteUrl({
        pageType: input.pageType,
        pageSlug: input.pageSlug,
        canonicalUrl: input.canonicalUrl ?? null,
      });

  const webPage = input.schemas.find((s) => schemaTypeOf(s) === "WebPage") as
    | { name?: string; url?: string; description?: string }
    | undefined;

  if (webPage) {
    const expectedTitle = input.title?.trim();
    if (expectedTitle && webPage.name && normalizeText(webPage.name) !== normalizeText(expectedTitle)) {
      issues.push({
        code: "title_mismatch",
        message: `WebPage.name "${webPage.name}" does not match page title "${expectedTitle}"`,
        severity: "error",
      });
    }
    if (webPage.url && normalizeText(webPage.url) !== normalizeText(pageUrl)) {
      issues.push({
        code: "url_mismatch",
        message: `WebPage.url "${webPage.url}" does not match canonical "${pageUrl}"`,
        severity: "error",
      });
    }
    if (
      input.metaDescription?.trim() &&
      webPage.description &&
      normalizeText(webPage.description) !== normalizeText(input.metaDescription)
    ) {
      issues.push({
        code: "description_mismatch",
        message: "WebPage.description does not match meta description",
        severity: "warning",
      });
    }
  }

  const faqSchema = input.schemas.find((s) => schemaTypeOf(s) === "FAQPage");
  if (input.faqs.length > 0) {
    if (!faqSchema) {
      issues.push({
        code: "missing_faq_schema",
        message: "Page has visible FAQs but no FAQPage schema",
        severity: "error",
      });
    } else {
      const schemaQuestions = faqQuestionsFromSchema(faqSchema);
      const visibleQuestions = input.faqs.map((f) => normalizeText(f.question));
      const schemaSet = new Set(schemaQuestions.map(normalizeText));
      for (const q of visibleQuestions) {
        if (!schemaSet.has(q)) {
          issues.push({
            code: "faq_mismatch",
            message: `FAQ question missing from FAQPage schema: "${q}"`,
            severity: "error",
          });
          break;
        }
      }
      if (schemaQuestions.length !== input.faqs.length) {
        issues.push({
          code: "faq_count_mismatch",
          message: `FAQPage has ${schemaQuestions.length} questions, page has ${input.faqs.length}`,
          severity: "warning",
        });
      }
    }
  }

  for (const schema of input.schemas) {
    const record = schema as { "@context"?: string; "@type"?: string };
    if (!record["@context"]?.includes("schema.org")) {
      issues.push({
        code: "invalid_context",
        message: `Schema ${record["@type"] ?? "unknown"} missing @context`,
        severity: "error",
      });
    }
  }

  const pass = !issues.some((i) => i.severity === "error");
  return { pass, schemaTypes, issues, checks };
}

/** Serialize schema bundle for SeoPage.customData storage. */
export function serializeSeoPageSchemas(schemas: object[]): string {
  return JSON.stringify({ schemas }, null, 2);
}

export function buildSchemaJsonFromContent(
  content: {
    title: string;
    metaDescription: string;
    breadcrumbItems: Array<{ name: string; url: string }>;
    faqs?: Array<{ question: string; answer: string }>;
  },
  absolutePageUrl: string,
): string {
  const schemas = buildSeoPageSchemaBundle({
    title: content.title,
    metaDescription: content.metaDescription,
    pageUrl: absolutePageUrl,
    breadcrumbItems: content.breadcrumbItems,
    faqs: content.faqs,
  });
  return serializeSeoPageSchemas(schemas);
}

export function breadcrumbPathFromItems(items: Array<{ name: string; url: string }>): string {
  const last = items[items.length - 1];
  return last?.url ? getCanonicalURL(last.url).replace(/^https?:\/\/[^/]+/, "") : "/";
}
