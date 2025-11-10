-- CreateTable
CREATE TABLE IF NOT EXISTS "portfolio_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tpv" DOUBLE PRECISION NOT NULL,
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBasis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReturn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReturnPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "details" JSONB,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "portfolio_snapshots_userId_timestamp_idx" ON "portfolio_snapshots"("userId", "timestamp");

