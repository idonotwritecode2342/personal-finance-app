-- Migration 001: Initial Schema
-- This represents the existing schema as of 2026-02-01
-- This migration is marked as already run for existing databases

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create countries table
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(50),
  currency_code VARCHAR(3)
);

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_id INT NOT NULL REFERENCES countries(id),
  bank_name VARCHAR(100),
  account_type VARCHAR(50),
  account_number_masked VARCHAR(20),
  currency VARCHAR(3),
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transaction_categories table
CREATE TABLE IF NOT EXISTS transaction_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  system_defined BOOLEAN DEFAULT TRUE
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_account_id INT NOT NULL REFERENCES bank_accounts(id),
  transaction_date DATE NOT NULL,
  amount DECIMAL(15, 2),
  currency VARCHAR(3),
  description TEXT,
  merchant VARCHAR(255),
  transaction_type VARCHAR(10),
  category_id INT REFERENCES transaction_categories(id),
  pdf_upload_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create pdf_uploads table
CREATE TABLE IF NOT EXISTS pdf_uploads (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_account_id INT REFERENCES bank_accounts(id),
  file_name VARCHAR(255),
  bank_detected VARCHAR(100),
  transaction_count INT,
  upload_status VARCHAR(20),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create currency_exchange_rates table
CREATE TABLE IF NOT EXISTS currency_exchange_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(3),
  to_currency VARCHAR(3),
  rate DECIMAL(10, 6),
  rate_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create session table for express-session
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- Insert countries
INSERT INTO countries (code, name, currency_code) VALUES
  ('UK', 'United Kingdom', 'GBP'),
  ('IN', 'India', 'INR')
ON CONFLICT (code) DO NOTHING;

-- Insert transaction categories
INSERT INTO transaction_categories (name, description, system_defined) VALUES
  ('Groceries', 'Food and grocery shopping', true),
  ('Utilities', 'Water, electricity, gas, internet', true),
  ('Transport', 'Fuel, public transit, car maintenance', true),
  ('Entertainment', 'Movies, gaming, hobbies', true),
  ('Dining', 'Restaurants, cafes, food delivery', true),
  ('Healthcare', 'Medical, pharmacy, wellness', true),
  ('Subscriptions', 'Apps, streaming, memberships', true),
  ('Salary/Income', 'Wages, bonuses, regular income', true),
  ('Savings', 'Transfers to savings accounts', true),
  ('Investments', 'Stock, ETF, crypto purchases', true),
  ('Insurance', 'Health, car, home insurance', true),
  ('Shopping', 'Clothing, home goods, miscellaneous', true),
  ('Fees', 'Bank fees, transaction costs', true)
ON CONFLICT (name) DO NOTHING;
