import { MetadataRoute } from 'next';
import { generateRobotsDirectives } from '@/lib/crawl-optimizer';

export default function robots(): MetadataRoute.Robots {
  const directives = generateRobotsDirectives();

  // Convert our custom format to Next.js MetadataRoute.Robots format
  const rules: MetadataRoute.Robots['rules'] = directives.map((d) => ({
    userAgent: d.userAgent,
    allow: d.allow,
    disallow: d.disallow,
    ...(d.crawlDelay ? { crawlDelay: d.crawlDelay } : {}),
  }));

  return {
    rules,
    sitemap: 'https://secretza.com/sitemap.xml',
    // Additional host declaration for clarity
    host: 'https://secretza.com',
  };
}
