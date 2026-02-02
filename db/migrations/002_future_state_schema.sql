-- Migration 002: Future State Schema
-- Adds new tables and columns for full feature support
-- Preserves all existing data

-- ============================================================================
-- DOMAIN 1: IDENTITY & GEO ENHANCEMENTS
-- ============================================================================

-- Add new columns to users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'display_name') THEN
    ALTER TABLE users ADD COLUMN display_name VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'default_country_code') THEN
    ALTER TABLE users ADD COLUMN default_country_code VARCHAR(2);
  END IF;
END $$;

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(50),
  symbol VARCHAR(5)
);

-- Seed currencies
INSERT INTO currencies (code, name, symbol) VALUES
  ('GBP', 'British Pound', '£'),
  ('INR', 'Indian Rupee', '₹'),
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€')
ON CONFLICT (code) DO NOTHING;

-- Enhance exchange_rates (rename from currency_exchange_rates for consistency)
-- Add source and unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'currency_exchange_rates' AND column_name = 'source') THEN
    ALTER TABLE currency_exchange_rates ADD COLUMN source VARCHAR(50) DEFAULT 'manual';
  END IF;
END $$;

-- Create unique index on exchange rates if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_rates_unique 
  ON currency_exchange_rates (from_currency, to_currency, rate_date);

-- ============================================================================
-- DOMAIN 2: INSTITUTIONS & ACCOUNTS
-- ============================================================================

-- Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country_id INT NOT NULL REFERENCES countries(id),
  institution_type VARCHAR(30) NOT NULL DEFAULT 'bank'
    CHECK (institution_type IN ('bank', 'broker', 'pension', 'crypto_exchange', 'other')),
  logo_url TEXT,
  website VARCHAR(255),
  detection_patterns JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, country_id)
);

-- Seed institutions
INSERT INTO institutions (name, country_id, institution_type, detection_patterns) VALUES
  ('HSBC', (SELECT id FROM countries WHERE code = 'UK'), 'bank', 
   '{"patterns": ["HSBC UK", "HSBC Bank", "hsbc.co.uk"]}'),
  ('Revolut', (SELECT id FROM countries WHERE code = 'UK'), 'bank',
   '{"patterns": ["Revolut", "revolut.com"]}'),
  ('AMEX', (SELECT id FROM countries WHERE code = 'UK'), 'bank',
   '{"patterns": ["American Express", "AMEX"]}'),
  ('Vanguard', (SELECT id FROM countries WHERE code = 'UK'), 'broker',
   '{"patterns": ["Vanguard", "vanguard.co.uk"]}'),
  ('HSBC', (SELECT id FROM countries WHERE code = 'IN'), 'bank',
   '{"patterns": ["HSBC India", "hsbc.co.in"]}'),
  ('ICICI', (SELECT id FROM countries WHERE code = 'IN'), 'bank',
   '{"patterns": ["ICICI Bank", "icicibank.com"]}'),
  ('Zerodha', (SELECT id FROM countries WHERE code = 'IN'), 'broker',
   '{"patterns": ["Zerodha", "zerodha.com", "Kite"]}'),
  ('Groww', (SELECT id FROM countries WHERE code = 'IN'), 'broker',
   '{"patterns": ["Groww", "groww.in"]}')
ON CONFLICT (name, country_id) DO NOTHING;

-- Add new columns to bank_accounts
DO $$
BEGIN
  -- Add institution_id foreign key
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_accounts' AND column_name = 'institution_id') THEN
    ALTER TABLE bank_accounts ADD COLUMN institution_id INT REFERENCES institutions(id);
  END IF;
  
  -- Add account_name for user labeling
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_accounts' AND column_name = 'account_name') THEN
    ALTER TABLE bank_accounts ADD COLUMN account_name VARCHAR(100);
  END IF;
  
  -- Add is_active flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_accounts' AND column_name = 'is_active') THEN
    ALTER TABLE bank_accounts ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Add opened_at and closed_at dates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_accounts' AND column_name = 'opened_at') THEN
    ALTER TABLE bank_accounts ADD COLUMN opened_at DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_accounts' AND column_name = 'closed_at') THEN
    ALTER TABLE bank_accounts ADD COLUMN closed_at DATE;
  END IF;
  
  -- Add notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_accounts' AND column_name = 'notes') THEN
    ALTER TABLE bank_accounts ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Create index on bank_accounts
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_institution ON bank_accounts(institution_id);

-- ============================================================================
-- DOMAIN 3: ACCOUNT BALANCES
-- ============================================================================

-- Create account_balances table for real-time + daily snapshots
CREATE TABLE IF NOT EXISTS account_balances (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) REFERENCES currencies(code),
  as_of_date DATE NOT NULL,
  as_of_time TIMESTAMPTZ,
  source VARCHAR(20) NOT NULL DEFAULT 'calculated'
    CHECK (source IN ('calculated', 'manual', 'statement', 'snapshot')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one balance per account per date per source
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_unique 
  ON account_balances (account_id, as_of_date, source);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_account_balances_lookup 
  ON account_balances (account_id, as_of_date DESC);

-- ============================================================================
-- DOMAIN 4: TRANSACTIONS & CATEGORIES ENHANCEMENTS
-- ============================================================================

-- Add new columns to transaction_categories
DO $$
BEGIN
  -- Add user_id for custom categories (NULL = system)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transaction_categories' AND column_name = 'user_id') THEN
    ALTER TABLE transaction_categories ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  -- Add parent_id for hierarchy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transaction_categories' AND column_name = 'parent_id') THEN
    ALTER TABLE transaction_categories ADD COLUMN parent_id INT REFERENCES transaction_categories(id);
  END IF;
  
  -- Add icon and color
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transaction_categories' AND column_name = 'icon') THEN
    ALTER TABLE transaction_categories ADD COLUMN icon VARCHAR(10);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transaction_categories' AND column_name = 'color') THEN
    ALTER TABLE transaction_categories ADD COLUMN color VARCHAR(7);
  END IF;
  
  -- Add is_income flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transaction_categories' AND column_name = 'is_income') THEN
    ALTER TABLE transaction_categories ADD COLUMN is_income BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add is_active flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transaction_categories' AND column_name = 'is_active') THEN
    ALTER TABLE transaction_categories ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Add display_order
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transaction_categories' AND column_name = 'display_order') THEN
    ALTER TABLE transaction_categories ADD COLUMN display_order INT DEFAULT 0;
  END IF;
  
  -- Add created_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transaction_categories' AND column_name = 'created_at') THEN
    ALTER TABLE transaction_categories ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Mark Salary/Income as income category
UPDATE transaction_categories SET is_income = TRUE WHERE name = 'Salary/Income';

-- Add icons and colors to existing categories
UPDATE transaction_categories SET icon = '🛒', color = '#22c55e' WHERE name = 'Groceries' AND icon IS NULL;
UPDATE transaction_categories SET icon = '💡', color = '#3b82f6' WHERE name = 'Utilities' AND icon IS NULL;
UPDATE transaction_categories SET icon = '🚗', color = '#f59e0b' WHERE name = 'Transport' AND icon IS NULL;
UPDATE transaction_categories SET icon = '🎬', color = '#8b5cf6' WHERE name = 'Entertainment' AND icon IS NULL;
UPDATE transaction_categories SET icon = '🍽️', color = '#ef4444' WHERE name = 'Dining' AND icon IS NULL;
UPDATE transaction_categories SET icon = '🏥', color = '#ec4899' WHERE name = 'Healthcare' AND icon IS NULL;
UPDATE transaction_categories SET icon = '📱', color = '#6366f1' WHERE name = 'Subscriptions' AND icon IS NULL;
UPDATE transaction_categories SET icon = '💰', color = '#22c55e' WHERE name = 'Salary/Income' AND icon IS NULL;
UPDATE transaction_categories SET icon = '🏦', color = '#14b8a6' WHERE name = 'Savings' AND icon IS NULL;
UPDATE transaction_categories SET icon = '📈', color = '#0ea5e9' WHERE name = 'Investments' AND icon IS NULL;
UPDATE transaction_categories SET icon = '🛡️', color = '#64748b' WHERE name = 'Insurance' AND icon IS NULL;
UPDATE transaction_categories SET icon = '🛍️', color = '#f97316' WHERE name = 'Shopping' AND icon IS NULL;
UPDATE transaction_categories SET icon = '💳', color = '#94a3b8' WHERE name = 'Fees' AND icon IS NULL;

-- Add new columns to transactions
DO $$
BEGIN
  -- Rename bank_account_id to account_id for consistency (keep both for compatibility)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'account_id') THEN
    ALTER TABLE transactions ADD COLUMN account_id INT REFERENCES bank_accounts(id);
    -- Copy existing data
    UPDATE transactions SET account_id = bank_account_id WHERE account_id IS NULL;
  END IF;
  
  -- Add extracted_txn_id for audit trail
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'extracted_txn_id') THEN
    ALTER TABLE transactions ADD COLUMN extracted_txn_id INT;
  END IF;
  
  -- Add notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'notes') THEN
    ALTER TABLE transactions ADD COLUMN notes TEXT;
  END IF;
  
  -- Add is_excluded flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'transactions' AND column_name = 'is_excluded') THEN
    ALTER TABLE transactions ADD COLUMN is_excluded BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create indexes on transactions
CREATE INDEX IF NOT EXISTS idx_txns_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_txns_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_txns_category ON transactions(category_id);

-- Create transaction_category_history for AI learning
CREATE TABLE IF NOT EXISTS transaction_category_history (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  old_category_id INT REFERENCES transaction_categories(id),
  new_category_id INT REFERENCES transaction_categories(id),
  source VARCHAR(20) NOT NULL CHECK (source IN ('llm_initial', 'user_override', 'bulk_update')),
  confidence DECIMAL(3, 2),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_history_txn ON transaction_category_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cat_history_date ON transaction_category_history(changed_at DESC);

-- ============================================================================
-- DOMAIN 5: PDF UPLOAD & EXTRACTION PIPELINE
-- ============================================================================

-- Add new columns to pdf_uploads
DO $$
BEGIN
  -- Add file_size_bytes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pdf_uploads' AND column_name = 'file_size_bytes') THEN
    ALTER TABLE pdf_uploads ADD COLUMN file_size_bytes INT;
  END IF;
  
  -- Add file_hash for dedup
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pdf_uploads' AND column_name = 'file_hash') THEN
    ALTER TABLE pdf_uploads ADD COLUMN file_hash VARCHAR(64);
  END IF;
  
  -- Add detected_institution_id FK
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pdf_uploads' AND column_name = 'detected_institution_id') THEN
    ALTER TABLE pdf_uploads ADD COLUMN detected_institution_id INT REFERENCES institutions(id);
  END IF;
  
  -- Add detection_confidence
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pdf_uploads' AND column_name = 'detection_confidence') THEN
    ALTER TABLE pdf_uploads ADD COLUMN detection_confidence DECIMAL(3, 2);
  END IF;
  
  -- Add llm_model
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pdf_uploads' AND column_name = 'llm_model') THEN
    ALTER TABLE pdf_uploads ADD COLUMN llm_model VARCHAR(100);
  END IF;
  
  -- Add llm_raw_response
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pdf_uploads' AND column_name = 'llm_raw_response') THEN
    ALTER TABLE pdf_uploads ADD COLUMN llm_raw_response JSONB;
  END IF;
  
  -- Add error_message
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pdf_uploads' AND column_name = 'error_message') THEN
    ALTER TABLE pdf_uploads ADD COLUMN error_message TEXT;
  END IF;
  
  -- Add processed_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pdf_uploads' AND column_name = 'processed_at') THEN
    ALTER TABLE pdf_uploads ADD COLUMN processed_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pdf_uploads_user ON pdf_uploads(user_id, uploaded_at DESC);

-- Create extracted_transactions staging table
CREATE TABLE IF NOT EXISTS extracted_transactions (
  id SERIAL PRIMARY KEY,
  pdf_upload_id INT NOT NULL REFERENCES pdf_uploads(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  transaction_date DATE,
  amount DECIMAL(15, 2),
  currency VARCHAR(3),
  merchant VARCHAR(255),
  description TEXT,
  transaction_type VARCHAR(10) CHECK (transaction_type IN ('debit', 'credit')),
  suggested_category_id INT REFERENCES transaction_categories(id),
  suggestion_confidence DECIMAL(3, 2),
  status VARCHAR(20) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'skipped', 'modified')),
  user_category_id INT REFERENCES transaction_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_extracted_txns_upload ON extracted_transactions(pdf_upload_id, row_index);

-- Add FK constraint on transactions.pdf_upload_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_transactions_pdf_upload'
  ) THEN
    -- First, clean up any orphaned pdf_upload_id references
    UPDATE transactions SET pdf_upload_id = NULL 
    WHERE pdf_upload_id IS NOT NULL 
      AND pdf_upload_id NOT IN (SELECT id FROM pdf_uploads);
    
    ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_pdf_upload 
      FOREIGN KEY (pdf_upload_id) REFERENCES pdf_uploads(id);
  END IF;
END $$;

-- Add FK for extracted_txn_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_transactions_extracted_txn'
  ) THEN
    ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_extracted_txn 
      FOREIGN KEY (extracted_txn_id) REFERENCES extracted_transactions(id);
  END IF;
END $$;

-- ============================================================================
-- DOMAIN 6: INVESTMENTS
-- ============================================================================

-- Create investments table (user-provided values)
CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id INT REFERENCES bank_accounts(id),
  institution_id INT REFERENCES institutions(id),
  name VARCHAR(255) NOT NULL,
  investment_type VARCHAR(30) NOT NULL
    CHECK (investment_type IN (
      'stock', 'etf', 'mutual_fund', 'index_fund',
      'pension', 'property', 'crypto', 'fd', 'bond', 'other'
    )),
  symbol VARCHAR(20),
  currency VARCHAR(3) REFERENCES currencies(code),
  country_code VARCHAR(2),
  initial_value DECIMAL(15, 2) NOT NULL,
  initial_date DATE,
  current_value DECIMAL(15, 2) NOT NULL,
  last_valued_at DATE NOT NULL,
  units DECIMAL(18, 8),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);

-- Create investment_valuations for history
CREATE TABLE IF NOT EXISTS investment_valuations (
  id SERIAL PRIMARY KEY,
  investment_id INT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  value DECIMAL(15, 2) NOT NULL,
  valued_at DATE NOT NULL,
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'api')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(investment_id, valued_at)
);

CREATE INDEX IF NOT EXISTS idx_investment_valuations ON investment_valuations(investment_id, valued_at DESC);

-- ============================================================================
-- DOMAIN 7: GOALS
-- ============================================================================

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  goal_type VARCHAR(30) NOT NULL
    CHECK (goal_type IN ('savings', 'investment', 'debt_payoff', 'net_worth', 'custom')),
  target_amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) REFERENCES currencies(code),
  current_amount DECIMAL(15, 2) DEFAULT 0,
  target_date DATE,
  country_code VARCHAR(2),
  icon VARCHAR(10),
  color VARCHAR(7),
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- Create goal_links to connect goals to accounts/investments
CREATE TABLE IF NOT EXISTS goal_links (
  id SERIAL PRIMARY KEY,
  goal_id INT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  account_id INT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  investment_id INT REFERENCES investments(id) ON DELETE CASCADE,
  contribution_pct DECIMAL(5, 2) DEFAULT 100,
  CHECK (account_id IS NOT NULL OR investment_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_goal_links_goal ON goal_links(goal_id);

-- ============================================================================
-- DOMAIN 8: SNAPSHOTS & ANALYTICS
-- ============================================================================

-- Create monthly_snapshots table
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code VARCHAR(2),
  snapshot_month DATE NOT NULL,
  total_income DECIMAL(15, 2),
  total_spend DECIMAL(15, 2),
  total_savings DECIMAL(15, 2),
  total_investments DECIMAL(15, 2),
  net_worth DECIMAL(15, 2),
  currency VARCHAR(3),
  breakdown JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, country_code, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_snapshots ON monthly_snapshots(user_id, snapshot_month DESC);

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INT REFERENCES transaction_categories(id),
  country_code VARCHAR(2),
  budget_month DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, country_code, budget_month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id, budget_month DESC);

-- ============================================================================
-- DOMAIN 9: AI CHAT
-- ============================================================================

-- Create ai_conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  page_route VARCHAR(100),
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_convos_user ON ai_conversations(user_id, updated_at DESC);

-- Create ai_messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_name VARCHAR(100),
  tool_input JSONB,
  tool_output JSONB,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_msgs_convo ON ai_messages(conversation_id, created_at);

-- ============================================================================
-- TRIGGER: Update account balance on transaction changes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  target_account_id INT;
  calc_balance DECIMAL(15,2);
  account_currency VARCHAR(3);
BEGIN
  -- Determine which account to update
  IF TG_OP = 'DELETE' THEN
    target_account_id := COALESCE(OLD.account_id, OLD.bank_account_id);
  ELSE
    target_account_id := COALESCE(NEW.account_id, NEW.bank_account_id);
  END IF;
  
  -- Skip if no account
  IF target_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate current balance from all transactions
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'credit' THEN amount
      WHEN transaction_type = 'debit' THEN -amount
      ELSE 0
    END
  ), 0) INTO calc_balance
  FROM transactions
  WHERE COALESCE(account_id, bank_account_id) = target_account_id
    AND is_excluded = FALSE;

  -- Get account currency
  SELECT currency INTO account_currency
  FROM bank_accounts WHERE id = target_account_id;

  -- Upsert today's calculated balance
  INSERT INTO account_balances (account_id, balance, currency, as_of_date, as_of_time, source)
  VALUES (
    target_account_id,
    calc_balance,
    account_currency,
    CURRENT_DATE,
    NOW(),
    'calculated'
  )
  ON CONFLICT (account_id, as_of_date, source)
  DO UPDATE SET balance = EXCLUDED.balance, as_of_time = NOW();

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_balance ON transactions;
CREATE TRIGGER trg_update_balance
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- ============================================================================
-- TRIGGER: Record category changes for AI learning
-- ============================================================================

CREATE OR REPLACE FUNCTION record_category_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record if category actually changed
  IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
    INSERT INTO transaction_category_history (
      transaction_id, 
      old_category_id, 
      new_category_id, 
      source,
      changed_at
    ) VALUES (
      NEW.id,
      OLD.category_id,
      NEW.category_id,
      'user_override',
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_record_category_change ON transactions;
CREATE TRIGGER trg_record_category_change
AFTER UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION record_category_change();

-- ============================================================================
-- Done!
-- ============================================================================
