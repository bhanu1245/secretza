-- CreateTable
CREATE TABLE "ContactReveal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactReveal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactReveal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ContactReveal_listingId_idx" ON "ContactReveal"("listingId");

-- CreateIndex
CREATE INDEX "ContactReveal_userId_idx" ON "ContactReveal"("userId");

-- CreateIndex
CREATE INDEX "ContactReveal_createdAt_idx" ON "ContactReveal"("createdAt");
