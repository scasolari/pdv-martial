-- Existing saved queries have no reliable database association. Keep them
-- unassigned so they are not shown under an arbitrary connected database.
CREATE TABLE "new_SavedQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "databaseId" TEXT,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedQuery_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "Database" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_SavedQuery" ("id", "userId", "databaseId", "name", "query", "createdAt", "updatedAt")
SELECT "id", "userId", NULL, "name", "query", "createdAt", "updatedAt" FROM "SavedQuery";

DROP TABLE "SavedQuery";
ALTER TABLE "new_SavedQuery" RENAME TO "SavedQuery";

CREATE UNIQUE INDEX "SavedQuery_databaseId_name_key" ON "SavedQuery"("databaseId", "name");
CREATE INDEX "SavedQuery_userId_databaseId_updatedAt_idx" ON "SavedQuery"("userId", "databaseId", "updatedAt");
