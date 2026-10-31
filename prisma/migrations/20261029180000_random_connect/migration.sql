-- CreateEnum
CREATE TYPE "ConnectMode" AS ENUM ('SURPRISE', 'SAME_CAMPUS', 'STUDY', 'INTERESTS', 'CAREER', 'GLOBAL');

-- CreateEnum
CREATE TYPE "ConnectSessionStatus" AS ENUM ('MATCH_FOUND', 'SESSION_ACTIVE', 'COMPLETED', 'CANCELLED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'REVIEWING', 'ESCALATED', 'CLOSED');

-- CreateTable
CREATE TABLE "ConnectPreference" (
    "userId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT '',
    "mode" "ConnectMode" NOT NULL DEFAULT 'SURPRISE',
    "studyIntent" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ConnectQueueEntry" (
    "userId" TEXT NOT NULL,
    "mode" "ConnectMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectQueueEntry_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ConnectSession" (
    "id" TEXT NOT NULL,
    "mode" "ConnectMode" NOT NULL,
    "status" "ConnectSessionStatus" NOT NULL DEFAULT 'MATCH_FOUND',
    "promptIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,

    CONSTRAINT "ConnectSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectParticipant" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "ConnectParticipant_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "ConnectHold" (
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "ConnectHold_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ConnectMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountRestriction" (
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountRestriction_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectQueueEntry_createdAt_idx" ON "ConnectQueueEntry"("createdAt");

-- CreateIndex
CREATE INDEX "ConnectSession_status_startedAt_idx" ON "ConnectSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ConnectParticipant_userId_idx" ON "ConnectParticipant"("userId");

-- CreateIndex
CREATE INDEX "ConnectHold_sessionId_idx" ON "ConnectHold"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectMessage_sessionId_clientKey_key" ON "ConnectMessage"("sessionId", "clientKey");

-- CreateIndex
CREATE INDEX "ConnectMessage_sessionId_createdAt_idx" ON "ConnectMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationCase_reportId_key" ON "ModerationCase"("reportId");

-- CreateIndex
CREATE INDEX "ModerationCase_status_createdAt_idx" ON "ModerationCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_caseId_createdAt_idx" ON "ModerationAction"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConnectPreference" ADD CONSTRAINT "ConnectPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectQueueEntry" ADD CONSTRAINT "ConnectQueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectParticipant" ADD CONSTRAINT "ConnectParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConnectSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectParticipant" ADD CONSTRAINT "ConnectParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectHold" ADD CONSTRAINT "ConnectHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectHold" ADD CONSTRAINT "ConnectHold_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConnectSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectMessage" ADD CONSTRAINT "ConnectMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConnectSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRestriction" ADD CONSTRAINT "AccountRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
