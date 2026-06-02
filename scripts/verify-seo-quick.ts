import { Database } from "bun:sqlite";

const db = new Database("prisma/db/custom.db");

const rows = db
  .query(
    `SELECT pageType,
      COUNT(*) as total,
      SUM(CASE WHEN title IS NOT NULL AND trim(title) != ''
        AND metaDescription IS NOT NULL AND trim(metaDescription) != ''
        AND h1 IS NOT NULL AND trim(h1) != ''
        AND introContent IS NOT NULL AND trim(introContent) != ''
        AND featuredImage IS NOT NULL AND trim(featuredImage) != ''
        AND imageAlt IS NOT NULL AND trim(imageAlt) != ''
        AND canonicalUrl IS NOT NULL AND trim(canonicalUrl) != ''
        AND customData IS NOT NULL AND trim(customData) != ''
        AND customData LIKE '%ImageObject%'
      THEN 1 ELSE 0 END) as complete,
      SUM(CASE WHEN featuredImage IS NOT NULL AND trim(featuredImage) != '' THEN 1 ELSE 0 END) as with_image
    FROM SeoPage GROUP BY pageType ORDER BY pageType`,
  )
  .all() as Array<{ pageType: string; total: number; complete: number; with_image: number }>;

const total = db.query("SELECT COUNT(*) as c FROM SeoPage").get() as { c: number };
const completeAll = rows.reduce((s, r) => s + r.complete, 0);

console.log(JSON.stringify({ total: total.c, complete: completeAll, byType: rows }, null, 2));

const sample = db
  .query(
    `SELECT pageType, pageSlug, title, canonicalUrl, featuredImage, imageAlt
     FROM SeoPage WHERE pageType = 'city' LIMIT 1`,
  )
  .get();
console.log("\nSample city page:", sample);

db.close();
