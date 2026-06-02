-- Complete production listing fields and area geo hierarchy.
CREATE TABLE "Area" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "listingCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Area_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Area_slug_cityId_key" ON "Area"("slug", "cityId");
CREATE INDEX "Area_cityId_isActive_idx" ON "Area"("cityId", "isActive");
CREATE INDEX "Area_isActive_listingCount_idx" ON "Area"("isActive", "listingCount" DESC);

ALTER TABLE "Listing" ADD COLUMN "subcategorySlug" TEXT;
ALTER TABLE "Listing" ADD COLUMN "area" TEXT;
ALTER TABLE "Listing" ADD COLUMN "services" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Listing" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "Listing" ADD COLUMN "telegram" TEXT;
ALTER TABLE "Listing" ADD COLUMN "age" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "profileImage" TEXT;
ALTER TABLE "Listing" ADD COLUMN "galleryImages" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Listing" ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN "subcategoryId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "areaId" TEXT;

CREATE INDEX "Listing_subcategoryId_idx" ON "Listing"("subcategoryId");
CREATE INDEX "Listing_areaId_idx" ON "Listing"("areaId");
