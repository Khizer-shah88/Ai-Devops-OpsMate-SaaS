-- CreateTable
CREATE TABLE "RepoMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "lastBranch" TEXT,
    "cloudTarget" "CloudTarget",
    "analysis" JSONB,
    "readiness" JSONB,
    "lastVersionId" TEXT,
    "lastPrUrl" TEXT,
    "lastPrNumber" INTEGER,
    "lastActionsRunId" TEXT,
    "lastActionsStatus" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepoMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoMemoryEvent" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepoMemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repo_memory_user_updated_idx" ON "RepoMemory"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "repo_memory_user_repo_url" ON "RepoMemory"("userId", "repoUrl");

-- CreateIndex
CREATE INDEX "repo_memory_event_memory_created_idx" ON "RepoMemoryEvent"("memoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "RepoMemory" ADD CONSTRAINT "RepoMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoMemoryEvent" ADD CONSTRAINT "RepoMemoryEvent_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "RepoMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
