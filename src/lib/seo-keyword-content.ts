import {
  getDateModified,
  type SEOContent,
} from "@/lib/seo-content";

const SITE_NAME = "SecretZa";

function truncateToLength(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3).trim()}...`;
}

/**
 * Fallback SEO content for keyword phrases without a detectable city.
 */
export function generateKeywordPhraseSEO(keyword: string, slug: string): SEOContent {
  const title = `${keyword} - Verified Listings | ${SITE_NAME}`;
  const metaDescription = truncateToLength(
    `Browse verified ${keyword.toLowerCase()} listings on SecretZa. Premium profiles, photos, reviews, and direct contact details updated daily.`,
    160,
  );
  const h1 = keyword;
  const introParagraph = `Looking for ${keyword}? SecretZa features curated listings matching "${keyword}" with detailed profiles, verified information, photos, and genuine user reviews. Filter by location, price, and availability to find options that match your preferences. New listings are added regularly — check back often for the latest profiles and featured providers.`;

  return {
    title,
    metaDescription,
    h1,
    introParagraph,
    faqs: [
      {
        question: `How do I find ${keyword} on SecretZa?`,
        answer: `Use SecretZa's search and filters to browse ${keyword.toLowerCase()} listings. Each profile includes photos, descriptions, and reviews to help you choose confidently.`,
      },
      {
        question: `Are ${keyword} listings verified?`,
        answer: `SecretZa moderates listings through verification checks, photo review, and user feedback. Look for verified badges and read reviews before connecting.`,
      },
    ],
    breadcrumbItems: [
      { name: "Home", url: "/" },
      { name: keyword, url: `/${slug}` },
    ],
    internalLinks: [
      { text: "Browse all listings", url: "/listings", type: "search" },
      { text: "Escorts in India", url: "/escorts", type: "category" },
    ],
    authorInfo: { name: "SecretZa Editorial Team", role: "SEO Content Editor" },
    pageType: "longtail",
    lastUpdated: getDateModified(),
    primaryKeyword: keyword,
  };
}
