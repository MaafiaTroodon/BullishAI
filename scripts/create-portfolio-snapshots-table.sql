-- Create portfolio_snapshots table for time-series portfolio data
-- Run this manually if migration doesn't work: psql $DATABASE_URL -f scripts/create-portfolio-snapshots-table.sql

CREATE TABLE IF NOT EXISTS "portfolio_snapshots" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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

-- CreateIndex for efficient queries
CREATE INDEX IF NOT EXISTS "portfolio_snapshots_userId_timestamp_idx" ON "portfolio_snapshots"("userId", "timestamp");