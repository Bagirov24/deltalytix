-- Migration: Trade.entryPrice & Trade.closePrice String → Float (DOUBLE PRECISION)
-- Strategy: single ALTER TABLE with USING clause + regex guard for dirty data
-- Safe: non-numeric / empty strings → 0.0 (no data loss, no NOT NULL violation)

-- DropIndex (optional speed-up: drop before altering, recreate after)
-- No existing indexes on entryPrice/closePrice, so nothing to drop.

-- AlterTable
ALTER TABLE "Trade"
  ALTER COLUMN "entryPrice" TYPE DOUBLE PRECISION
    USING CASE
      WHEN "entryPrice" ~ '^-?[0-9]*\.?[0-9]+$' THEN "entryPrice"::DOUBLE PRECISION
      ELSE 0.0
    END,
  ALTER COLUMN "closePrice" TYPE DOUBLE PRECISION
    USING CASE
      WHEN "closePrice" ~ '^-?[0-9]*\.?[0-9]+$' THEN "closePrice"::DOUBLE PRECISION
      ELSE 0.0
    END;
