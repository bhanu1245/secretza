-- CreateTable
CREATE TABLE "SeoJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" REAL NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "batchSize" INTEGER NOT NULL DEFAULT 100,
    "lastProcessedId" TEXT,
    "lastCheckpointAt" DATETIME,
    "estimatedTimeRemaining" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "payloadJson" TEXT,
    "issueTypesJson" TEXT,
    "errorLog" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeoJobItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "seoPageId" TEXT,
    "pageType" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeoJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SeoJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeoJobItem_seoPageId_fkey" FOREIGN KEY ("seoPageId") REFERENCES "SeoPage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SeoJob_status_idx" ON "SeoJob"("status");

-- CreateIndex
CREATE INDEX "SeoJob_jobType_status_idx" ON "SeoJob"("jobType", "status");

-- CreateIndex
CREATE INDEX "SeoJob_createdAt_idx" ON "SeoJob"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "SeoJobItem_jobId_status_idx" ON "SeoJobItem"("jobId", "status");

-- CreateIndex
CREATE INDEX "SeoJobItem_jobId_seoPageId_idx" ON "SeoJobItem"("jobId", "seoPageId");

-- CreateIndex
CREATE INDEX "SeoJobItem_seoPageId_idx" ON "SeoJobItem"("seoPageId");
