-- CreateEnum
CREATE TYPE "public"."ValidationRunStatus" AS ENUM ('PENDING', 'COMPLETE', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ValidationSeverity" AS ENUM ('ERROR', 'WARNING', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "public"."ValidationOrigin" AS ENUM ('RULES', 'GRAPH', 'SEMANTIC');

-- CreateEnum
CREATE TYPE "public"."ValidationNoticeStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."ValidationActionType" AS ENUM ('ACCEPTED', 'REJECTED', 'APPLIED', 'APPLICATION_FAILED');

-- CreateTable
CREATE TABLE "public"."ValidationRun" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "requestedById" INTEGER,
    "snapshotHash" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "modelVersion" TEXT,
    "status" "public"."ValidationRunStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ValidationNotice" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "severity" "public"."ValidationSeverity" NOT NULL,
    "origin" "public"."ValidationOrigin" NOT NULL,
    "status" "public"."ValidationNoticeStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "affected" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ValidationNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ValidationAction" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "actorId" INTEGER,
    "auditActionId" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "type" "public"."ValidationActionType" NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValidationRun_projectId_createdAt_idx" ON "public"."ValidationRun"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRun_projectId_snapshotHash_catalogVersion_key" ON "public"."ValidationRun"("projectId", "snapshotHash", "catalogVersion");

-- CreateIndex
CREATE INDEX "ValidationNotice_runId_severity_idx" ON "public"."ValidationNotice"("runId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationNotice_runId_fingerprint_key" ON "public"."ValidationNotice"("runId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationAction_auditActionId_key" ON "public"."ValidationAction"("auditActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationAction_idempotencyKey_key" ON "public"."ValidationAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ValidationAction_noticeId_createdAt_idx" ON "public"."ValidationAction"("noticeId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."ValidationRun" ADD CONSTRAINT "ValidationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Proyecto"("id_proyecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ValidationRun" ADD CONSTRAINT "ValidationRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."Usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ValidationNotice" ADD CONSTRAINT "ValidationNotice_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ValidationAction" ADD CONSTRAINT "ValidationAction_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "public"."ValidationNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ValidationAction" ADD CONSTRAINT "ValidationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."Usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ValidationAction" ADD CONSTRAINT "ValidationAction_auditActionId_fkey" FOREIGN KEY ("auditActionId") REFERENCES "public"."Acciones_Proyecto"("id_accion") ON DELETE SET NULL ON UPDATE CASCADE;

