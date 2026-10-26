-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT
);

-- CreateTable
CREATE TABLE "Database" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "db_name" TEXT NOT NULL,
    "db_url_connection" TEXT NOT NULL,
    "preferences" TEXT,
    "authorizationConfirmedAt" DATETIME,
    "authorizationVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Database_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DatabaseAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "database_id" TEXT NOT NULL,
    "database_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "query" TEXT,
    "table_name" TEXT,
    "affected_rows" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'started',
    "error_code" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DatabaseAuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalConnectionLease" (
    "slot_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lease_token" TEXT,
    "expires_at" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_userId_documentType_documentVersion_key" ON "LegalAcceptance"("userId", "documentType", "documentVersion");

-- CreateIndex
CREATE INDEX "DatabaseAuditLog_user_id_createdAt_idx" ON "DatabaseAuditLog"("user_id", "createdAt");

-- CreateIndex
CREATE INDEX "DatabaseAuditLog_user_id_database_id_createdAt_idx" ON "DatabaseAuditLog"("user_id", "database_id", "createdAt");

-- CreateIndex
CREATE INDEX "DatabaseAuditLog_database_id_createdAt_idx" ON "DatabaseAuditLog"("database_id", "createdAt");

-- CreateIndex
CREATE INDEX "DatabaseAuditLog_status_createdAt_idx" ON "DatabaseAuditLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DatabaseAuditLog_createdAt_idx" ON "DatabaseAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExternalConnectionLease_expires_at_idx" ON "ExternalConnectionLease"("expires_at");

