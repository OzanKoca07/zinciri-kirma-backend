-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('RECOVERY_PLUS_1');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncBackup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 2,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardedEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SyncBackup_userId_createdAt_idx" ON "SyncBackup"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecoveryWallet_userId_month_idx" ON "RecoveryWallet"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryWallet_userId_month_key" ON "RecoveryWallet"("userId", "month");

-- CreateIndex
CREATE INDEX "RewardedEvent_userId_createdAt_idx" ON "RewardedEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SyncBackup" ADD CONSTRAINT "SyncBackup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryWallet" ADD CONSTRAINT "RecoveryWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardedEvent" ADD CONSTRAINT "RewardedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
