// ==========================================
// Page Structured Data Generator
// ==========================================
// Generates JSON-LD structured data for each SEO page type.
// Used by all SEO page routes for rich search results.

import type { SEOContent } from "@/lib/seo-content";
import type { IndiaCity, IndiaState } from "@/lib/india-geo-data";

const BASE_URL = "https://secretza.com";

// ------------------------------------------
// Generic Schema Generators
// ------------------------------------------

/**
 * Generate a WebPage schema with datePublished and dateModified.
 * Google-recommended quality signal for every page.
 */
export function generateWebPageSchema(data: {
  name: string;
  url: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: data.name,
    url: data.url,
    description: data.description,
    datePublished: data.datePublished || "2024-01-01",
    dateModified: data.dateModified || new Date().toISOString().split("T")[0],
    isPartOf: {
      "@type": "WebSite",
      name: "Secretza",
      url: "https://secretza.com",
    },
  };
}

/**
 * Generate an enhanced Organization schema with contact, social, and founding details.
 * Google-recommended quality signal for entity identity.
 */
export function generateEnhancedOrganizationSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Secretza",
    url: "https://secretza.com",
    logo: "https://secretza.com/logo.png",
    description: "India's Premium Adult Classifieds Platform",
    sameAs: [
      "https://twitter.com/secretza",
      "https://instagram.com/secretza",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@secretza.com",
      availableLanguage: ["English", "Hindi"],
    },
    foundingDate: "2024",
    numberOfEmployees: {
      "@type": "QuantitativeValue",
      minValue: 10,
      maxValue: 50,
    },
  };
}

/**
 * Generate an enhanced WebSite schema with EntryPoint SearchAction, language, and author.
 * Google-recommended quality signal for site-level identity.
 */
export function generateEnhancedWebSiteSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Secretza",
    url: "https://secretza.com",
    description: "India's Premier Adult Classifieds Platform",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://secretza.com/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: "en-IN",
    copyrightYear: 2024,
    author: {
      "@type": "Organization",
      name: "Secretza",
    },
  };
}

/**
 * Generate a Person schema for the author/editor (E-E-A-T signal).
 * Google recommends author attribution for quality content.
 */
export function generateAuthorSchema(data: {
  name: string;
  role: string;
  url?: string;
}): object {
  const author: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: data.name,
    jobTitle: data.role,
    worksFor: {
      "@type": "Organization",
      name: "Secretza",
      url: "https://secretza.com",
    },
  };
  if (data.url) {
    author.url = data.url;
  }
  return author;
}

/**
 * Generate a publisher Organization schema (E-E-A-T signal).
 */
export function generatePublisherSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Secretza",
    url: "https://secretza.com",
    logo: {
      "@type": "ImageObject",
      url: "https://secretza.com/logo.png",
    },
    publishingPrinciples: "https://secretza.com/safety",
    sameAs: [
      "https://twitter.com/secretza",
      "https://instagram.com/secretza",
    ],
  };
}

/**
 * Generate a BreadcrumbList schema.
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

/**
 * Generate an FAQPage schema.
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): object {
  if (faqs.length === 0) return {};
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate an ItemList schema.
 */
export function generateItemListSchema(
  name: string,
  items: Array<{ name: string; url: string; position?: number }>
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: item.position ?? index + 1,
      name: item.name,
      url: item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

// ------------------------------------------
// Page-Specific Schema Generators
// ------------------------------------------

/**
 * Generate all structured data for a city page.
 */
export function generateCityPageSchemas(
  seo: SEOContent,
  city: IndiaCity,
  stateName: string
): object[] {
  const schemas: object[] = [];

  // Breadcrumb
  if (seo.breadcrumbItems.length > 0) {
    schemas.push(generateBreadcrumbSchema(seo.breadcrumbItems));
  }

  // FAQ
  if (seo.faqs.length > 0) {
    schemas.push(generateFAQSchema(seo.faqs));
  }

  // ItemList - Internal links as an item list
  const cityLinks = seo.internalLinks
    .filter((l) => l.type === "city")
    .map((l) => ({ name: l.text, url: l.url }));
  if (cityLinks.length > 0) {
    schemas.push(generateItemListSchema(`${city.name} Nearby Cities`, cityLinks));
  }

  // WebPage schema (Google quality signal)
  schemas.push(
    generateWebPageSchema({
      name: seo.h1,
      url: `${BASE_URL}/${city.slug}`,
      description: seo.metaDescription,
    })
  );

  // Author schema (E-E-A-T signal)
  if (seo.authorInfo) {
    schemas.push(generateAuthorSchema(seo.authorInfo));
  }

  // Publisher schema (E-E-A-T signal)
  schemas.push(generatePublisherSchema());

  return schemas;
}

/**
 * Generate all structured data for a category page.
 */
export function generateCategoryPageSchemas(
  seo: SEOContent,
  category: { name: string; slug: string }
): object[] {
  const schemas: object[] = [];

  // Breadcrumb
  if (seo.breadcrumbItems.length > 0) {
    schemas.push(generateBreadcrumbSchema(seo.breadcrumbItems));
  }

  // FAQ
  if (seo.faqs.length > 0) {
    schemas.push(generateFAQSchema(seo.faqs));
  }

  // ItemList - City links
  const cityLinks = seo.internalLinks
    .filter((l) => l.type === "search")
    .map((l) => ({ name: l.text, url: l.url }));
  if (cityLinks.length > 0) {
    schemas.push(
      generateItemListSchema(`${category.name} in Indian Cities`, cityLinks)
    );
  }

  // WebPage schema (Google quality signal)
  schemas.push(
    generateWebPageSchema({
      name: seo.h1,
      url: `${BASE_URL}/${category.slug}`,
      description: seo.metaDescription,
    })
  );

  // Author schema (E-E-A-T signal)
  if (seo.authorInfo) {
    schemas.push(generateAuthorSchema(seo.authorInfo));
  }

  // Publisher schema (E-E-A-T signal)
  schemas.push(generatePublisherSchema());

  return schemas;
}

/**
 * Generate all structured data for a category+city page.
 */
export function generateCategoryCityPageSchemas(
  seo: SEOContent,
  city: IndiaCity,
  category: { name: string; slug: string },
  stateName: string
): object[] {
  const schemas: object[] = [];

  // Breadcrumb
  if (seo.breadcrumbItems.length > 0) {
    schemas.push(generateBreadcrumbSchema(seo.breadcrumbItems));
  }

  // FAQ
  if (seo.faqs.length > 0) {
    schemas.push(generateFAQSchema(seo.faqs));
  }

  // ItemList - Other categories in this city
  const categoryLinks = seo.internalLinks
    .filter((l) => l.type === "search" && l.url.includes(`/${category.slug}/`) === false)
    .map((l) => ({ name: l.text, url: l.url }));
  if (categoryLinks.length > 0) {
    schemas.push(
      generateItemListSchema(`Categories in ${city.name}`, categoryLinks)
    );
  }

  // WebPage schema (Google quality signal)
  schemas.push(
    generateWebPageSchema({
      name: seo.h1,
      url: `${BASE_URL}/${category.slug}/${city.slug}`,
      description: seo.metaDescription,
    })
  );

  // Author schema (E-E-A-T signal)
  if (seo.authorInfo) {
    schemas.push(generateAuthorSchema(seo.authorInfo));
  }

  // Publisher schema (E-E-A-T signal)
  schemas.push(generatePublisherSchema());

  return schemas;
}

/**
 * Generate all structured data for a state page.
 */
export function generateStatePageSchemas(
  seo: SEOContent,
  state: IndiaState
): object[] {
  const schemas: object[] = [];

  // Breadcrumb
  if (seo.breadcrumbItems.length > 0) {
    schemas.push(generateBreadcrumbSchema(seo.breadcrumbItems));
  }

  // FAQ
  if (seo.faqs.length > 0) {
    schemas.push(generateFAQSchema(seo.faqs));
  }

  // ItemList - Cities in this state
  const cityLinks = seo.internalLinks
    .filter((l) => l.type === "city")
    .map((l) => ({ name: l.text, url: l.url }));
  if (cityLinks.length > 0) {
    schemas.push(
      generateItemListSchema(`Cities in ${state.name}`, cityLinks)
    );
  }

  // WebPage schema (Google quality signal)
  schemas.push(
    generateWebPageSchema({
      name: seo.h1,
      url: `${BASE_URL}/india/${state.slug}`,
      description: seo.metaDescription,
    })
  );

  // Author schema (E-E-A-T signal)
  if (seo.authorInfo) {
    schemas.push(generateAuthorSchema(seo.authorInfo));
  }

  // Publisher schema (E-E-A-T signal)
  schemas.push(generatePublisherSchema());

  return schemas;
}

/**
 * Generate all structured data for a country page.
 */
export function generateCountryPageSchemas(seo: SEOContent): object[] {
  const schemas: object[] = [];

  // Breadcrumb
  if (seo.breadcrumbItems.length > 0) {
    schemas.push(generateBreadcrumbSchema(seo.breadcrumbItems));
  }

  // FAQ
  if (seo.faqs.length > 0) {
    schemas.push(generateFAQSchema(seo.faqs));
  }

  // ItemList - All categories
  const categoryLinks = seo.internalLinks
    .filter((l) => l.type === "category")
    .map((l) => ({ name: l.text, url: l.url }));
  if (categoryLinks.length > 0) {
    schemas.push(
      generateItemListSchema("Adult Categories in India", categoryLinks)
    );
  }

  // ItemList - Top cities
  const cityLinks = seo.internalLinks
    .filter((l) => l.type === "city")
    .map((l) => ({ name: l.text, url: l.url }));
  if (cityLinks.length > 0) {
    schemas.push(
      generateItemListSchema("Top Indian Cities", cityLinks)
    );
  }

  // WebPage schema (Google quality signal)
  schemas.push(
    generateWebPageSchema({
      name: seo.h1,
      url: `${BASE_URL}/india`,
      description: seo.metaDescription,
    })
  );

  // Author schema (E-E-A-T signal)
  if (seo.authorInfo) {
    schemas.push(generateAuthorSchema(seo.authorInfo));
  }

  // Publisher schema (E-E-A-T signal)
  schemas.push(generatePublisherSchema());

  return schemas;
}

// ------------------------------------------
// JSON-LD Render Component (for use in server components)
// ------------------------------------------

/**
 * Renders an array of JSON-LD schemas as script tags.
 * For use in server components only.
 */
export function renderJsonLd(schemas: object[]): string {
  return schemas
    .map((schema) => {
      return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    })
    .join("\n");
}
