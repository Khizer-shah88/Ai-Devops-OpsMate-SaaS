-- AlterTable
ALTER TABLE "User"
ADD COLUMN "githubUsername" TEXT,
ADD COLUMN "githubAvatarUrl" TEXT,
ADD COLUMN "githubTokenEnc" TEXT,
ADD COLUMN "githubConnectedAt" TIMESTAMP(3);
