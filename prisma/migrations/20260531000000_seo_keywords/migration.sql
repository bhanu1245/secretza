-- AddColumns: primaryKeyword and secondaryKeywords to SeoPage
ALTER TABLE "SeoPage" ADD COLUMN "primaryKeyword" TEXT;
ALTER TABLE "SeoPage" ADD COLUMN "secondaryKeywords" TEXT;
