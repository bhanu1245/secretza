-- Composite indexes for approved-listing count queries (status + location/category FK)
CREATE INDEX "Listing_status_categoryId_idx" ON "Listing"("status", "categoryId");
CREATE INDEX "Listing_status_subcategoryId_idx" ON "Listing"("status", "subcategoryId");
CREATE INDEX "Listing_status_countryId_idx" ON "Listing"("status", "countryId");
CREATE INDEX "Listing_status_stateId_idx" ON "Listing"("status", "stateId");
CREATE INDEX "Listing_status_cityId_idx" ON "Listing"("status", "cityId");
CREATE INDEX "Listing_status_areaId_idx" ON "Listing"("status", "areaId");
