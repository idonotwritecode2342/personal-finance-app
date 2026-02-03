-- Migration 006: Add unique constraint to prevent duplicate transactions
-- Prevents the same transaction from being inserted multiple times

-- First, remove any existing duplicates before adding the constraint
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY bank_account_id, transaction_date, amount, COALESCE(description, ''), COALESCE(merchant, '')
      ORDER BY created_at DESC
    ) AS row_num
  FROM transactions
)
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Add unique constraint
-- Note: Using a partial index instead of unique constraint to handle NULL values gracefully
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique
ON transactions (bank_account_id, transaction_date, amount, COALESCE(description, ''), COALESCE(merchant, ''));
