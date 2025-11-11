/*
  Warnings:

  - You are about to drop the `portfolio_snapshots` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "portfolios" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "dripEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "meta" JSONB,
ADD COLUMN     "securityId" TEXT;

-- DropTable
DROP TABLE "portfolio_snapshots";

-- CreateTable
CREATE TABLE "securities" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "exchange" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dividendFreq" TEXT,
    "ttmDividendPerShare" DOUBLE PRECISION,
    "lastExDate" TIMESTAMP(3),
    "nextExDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "securities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_actions" (
    "id" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "exDate" TIMESTAMP(3) NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3),
    "amountPerShare" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_payouts" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "corporateActionId" TEXT NOT NULL,
    "qtyOnRecord" DOUBLE PRECISION NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "withholdTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRate" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dividend_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "securities_symbol_key" ON "securities"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_fromCurrency_toCurrency_date_key" ON "fx_rates"("fromCurrency", "toCurrency", "date");

-- AddForeignKey
ALTER TABLE "corporate_actions" ADD CONSTRAINT "corporate_actions_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_payouts" ADD CONSTRAINT "dividend_payouts_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_payouts" ADD CONSTRAINT "dividend_payouts_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_payouts" ADD CONSTRAINT "dividend_payouts_corporateActionId_fkey" FOREIGN KEY ("corporateActionId") REFERENCES "corporate_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
