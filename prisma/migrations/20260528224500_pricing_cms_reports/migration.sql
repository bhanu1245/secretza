CREATE TABLE "PricingPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "price" REAL NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "durationDays" INTEGER NOT NULL,
  "featuredDays" INTEGER NOT NULL DEFAULT 0,
  "boostDays" INTEGER NOT NULL DEFAULT 0,
  "listingLimit" INTEGER NOT NULL DEFAULT 1,
  "imageLimit" INTEGER NOT NULL DEFAULT 5,
  "premiumBadge" BOOLEAN NOT NULL DEFAULT false,
  "priorityScore" REAL NOT NULL DEFAULT 0,
  "features" TEXT NOT NULL DEFAULT '[]',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isPopular" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "PricingPlan_slug_key" ON "PricingPlan"("slug");
CREATE INDEX "PricingPlan_isActive_sortOrder_idx" ON "PricingPlan"("isActive", "sortOrder");

CREATE TABLE "CmsPage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "excerpt" TEXT,
  "seoTitle" TEXT,
  "metaDescription" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "CmsPage_slug_key" ON "CmsPage"("slug");
CREATE INDEX "CmsPage_isPublished_slug_idx" ON "CmsPage"("isPublished", "slug");
CREATE INDEX "CmsPage_updatedAt_idx" ON "CmsPage"("updatedAt" DESC);

ALTER TABLE "ListingReport" ADD COLUMN "moderatorNotes" TEXT;
