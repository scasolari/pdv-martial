-- CreateTable
CREATE TABLE "SavedQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedQuery_userId_name_key" ON "SavedQuery"("userId", "name");

-- CreateIndex
CREATE INDEX "SavedQuery_userId_updatedAt_idx" ON "SavedQuery"("userId", "updatedAt");
