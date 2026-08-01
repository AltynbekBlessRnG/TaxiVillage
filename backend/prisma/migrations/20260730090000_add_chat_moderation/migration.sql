CREATE TYPE "ModerationReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'RESOLVED');

CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageReport" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "context" TEXT,
    "status" "ModerationReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBlock_blockerUserId_blockedUserId_key"
ON "UserBlock"("blockerUserId", "blockedUserId");
CREATE INDEX "UserBlock_blockerUserId_createdAt_idx"
ON "UserBlock"("blockerUserId", "createdAt");
CREATE INDEX "UserBlock_blockedUserId_idx" ON "UserBlock"("blockedUserId");
CREATE INDEX "MessageReport_reporterUserId_createdAt_idx"
ON "MessageReport"("reporterUserId", "createdAt");
CREATE INDEX "MessageReport_reportedUserId_status_createdAt_idx"
ON "MessageReport"("reportedUserId", "status", "createdAt");
CREATE INDEX "MessageReport_messageId_idx" ON "MessageReport"("messageId");
