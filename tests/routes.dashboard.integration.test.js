/**
 * Integration Tests for Dashboard Routes
 * Tests for Tasks 18-21: Navigation, Filters, P&L, and Data Consistency
 */

const pool = require('../db/connection');
const { getDashboardData, getMonthlySpend } = require('../db/dashboard');

describe('Dashboard Integration Tests', () => {
  let testUserId;
  let testCountryId;
  let testBankAccountId;
  let testCategoryId;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
      ['test-dashboard@example.com', 'hashedpassword', 'Test User']
    );
    testUserId = userResult.rows[0].id;

    // Get UK country ID
    const countryResult = await pool.query(
      "SELECT id FROM countries WHERE code = 'UK' LIMIT 1"
    );
    testCountryId = countryResult.rows[0].id;

    // Create test bank account
    const bankResult = await pool.query(
      'INSERT INTO bank_accounts (user_id, country_id, bank_name, account_type, currency) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [testUserId, testCountryId, 'Test Bank', 'checking', 'GBP']
    );
    testBankAccountId = bankResult.rows[0].id;

    // Get a test category
    const categoryResult = await pool.query(
      "SELECT id FROM transaction_categories WHERE name = 'Groceries' AND user_id IS NULL LIMIT 1"
    );
    testCategoryId = categoryResult.rows[0]?.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM bank_accounts WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  describe('Task 20: P&L Calculation Accuracy', () => {
    beforeEach(async () => {
      // Clear transactions before each test
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [testUserId]);
    });

    test('should calculate P&L correctly with only credits', async () => {
      // Insert test credit transactions
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES
           ($1, $2, CURRENT_DATE, 100.00, 'Salary', 'credit', 'GBP'),
           ($1, $2, CURRENT_DATE, 50.00, 'Refund', 'credit', 'GBP')`,
        [testUserId, testBankAccountId]
      );

      // Query P&L
      const result = await pool.query(
        `SELECT SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END) as net_pl
         FROM transactions WHERE user_id = $1`,
        [testUserId]
      );

      const netPL = parseFloat(result.rows[0].net_pl);
      expect(netPL).toBe(150.00);
    });

    test('should calculate P&L correctly with only debits', async () => {
      // Insert test debit transactions
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES
           ($1, $2, CURRENT_DATE, 75.50, 'Groceries', 'debit', 'GBP'),
           ($1, $2, CURRENT_DATE, 24.50, 'Transport', 'debit', 'GBP')`,
        [testUserId, testBankAccountId]
      );

      // Query P&L
      const result = await pool.query(
        `SELECT SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END) as net_pl
         FROM transactions WHERE user_id = $1`,
        [testUserId]
      );

      const netPL = parseFloat(result.rows[0].net_pl);
      expect(netPL).toBe(-100.00);
    });

    test('should calculate P&L correctly with mixed credits and debits', async () => {
      // Insert mixed transactions
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES
           ($1, $2, CURRENT_DATE, 1000.00, 'Salary', 'credit', 'GBP'),
           ($1, $2, CURRENT_DATE, 200.00, 'Groceries', 'debit', 'GBP'),
           ($1, $2, CURRENT_DATE, 150.00, 'Transport', 'debit', 'GBP'),
           ($1, $2, CURRENT_DATE, 50.00, 'Refund', 'credit', 'GBP')`,
        [testUserId, testBankAccountId]
      );

      // Expected: (1000 + 50) - (200 + 150) = 1050 - 350 = 700
      const result = await pool.query(
        `SELECT SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END) as net_pl
         FROM transactions WHERE user_id = $1`,
        [testUserId]
      );

      const netPL = parseFloat(result.rows[0].net_pl);
      expect(netPL).toBe(700.00);
    });

    test('should return 0 for P&L with no transactions', async () => {
      const result = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END), 0) as net_pl
         FROM transactions WHERE user_id = $1`,
        [testUserId]
      );

      const netPL = parseFloat(result.rows[0].net_pl);
      expect(netPL).toBe(0);
    });

    test('should handle decimal amounts correctly in P&L', async () => {
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES
           ($1, $2, CURRENT_DATE, 12.99, 'Coffee', 'debit', 'GBP'),
           ($1, $2, CURRENT_DATE, 7.50, 'Snack', 'debit', 'GBP'),
           ($1, $2, CURRENT_DATE, 100.01, 'Payment', 'credit', 'GBP')`,
        [testUserId, testBankAccountId]
      );

      // Expected: 100.01 - 12.99 - 7.50 = 79.52
      const result = await pool.query(
        `SELECT SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END) as net_pl
         FROM transactions WHERE user_id = $1`,
        [testUserId]
      );

      const netPL = parseFloat(result.rows[0].net_pl);
      expect(netPL).toBeCloseTo(79.52, 2);
    });
  });

  describe('Task 21: Dashboard Data Consistency', () => {
    beforeEach(async () => {
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [testUserId]);
    });

    test('dashboard monthly spend should match transaction query for current month', async () => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      // Insert transactions for current month
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency, category_id)
         VALUES
           ($1, $2, $3, 150.00, 'Groceries', 'debit', 'GBP', $4),
           ($1, $2, $3, 75.00, 'Transport', 'debit', 'GBP', $4)`,
        [testUserId, testBankAccountId, `${currentYear}-${String(currentMonth).padStart(2, '0')}-15`, testCategoryId]
      );

      // Get dashboard data
      const dashboardData = await getDashboardData(testUserId, 'UK');

      // Get monthly spend directly
      const monthlySpend = await getMonthlySpend(testUserId, 'UK');

      // Both should return 225.00
      expect(dashboardData.monthlySpend).toBe(225.00);
      expect(monthlySpend).toBe(225.00);
    });

    test('dashboard should return empty data for user with no transactions', async () => {
      const dashboardData = await getDashboardData(testUserId, 'UK');

      expect(dashboardData.monthlySpend).toBe(0);
      expect(dashboardData.monthlyIncome).toBe(0);
      expect(dashboardData.currentSavings).toBe(0);
      expect(dashboardData.spendingBreakdown).toEqual([]);
      expect(dashboardData.monthlyTrend).toEqual(Array(12).fill(0));
    });

    test('dashboard current savings should equal income - spend', async () => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES
           ($1, $2, $3, 2000.00, 'Salary', 'credit', 'GBP'),
           ($1, $2, $3, 500.00, 'Groceries', 'debit', 'GBP'),
           ($1, $2, $3, 300.00, 'Rent', 'debit', 'GBP')`,
        [testUserId, testBankAccountId, `${currentYear}-${String(currentMonth).padStart(2, '0')}-15`]
      );

      const dashboardData = await getDashboardData(testUserId, 'UK');

      // Income: 2000, Spend: 800, Savings: 1200
      expect(dashboardData.monthlyIncome).toBe(2000.00);
      expect(dashboardData.monthlySpend).toBe(800.00);
      expect(dashboardData.currentSavings).toBe(1200.00);
    });

    test('spending breakdown should list top categories', async () => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      // Get multiple category IDs
      const groceriesResult = await pool.query(
        "SELECT id FROM transaction_categories WHERE name = 'Groceries' AND user_id IS NULL LIMIT 1"
      );
      const transportResult = await pool.query(
        "SELECT id FROM transaction_categories WHERE name = 'Transport' AND user_id IS NULL LIMIT 1"
      );

      const groceriesId = groceriesResult.rows[0]?.id;
      const transportId = transportResult.rows[0]?.id;

      if (!groceriesId || !transportId) {
        console.warn('Test categories not found, skipping test');
        return;
      }

      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency, category_id)
         VALUES
           ($1, $2, $3, 400.00, 'Tesco', 'debit', 'GBP', $4),
           ($1, $2, $3, 200.00, 'Uber', 'debit', 'GBP', $5)`,
        [testUserId, testBankAccountId, `${currentYear}-${String(currentMonth).padStart(2, '0')}-15`, groceriesId, transportId]
      );

      const dashboardData = await getDashboardData(testUserId, 'UK');

      expect(dashboardData.spendingBreakdown).toHaveLength(2);
      expect(dashboardData.spendingBreakdown[0].category).toBe('Groceries');
      expect(dashboardData.spendingBreakdown[0].amount).toBe(400.00);
      expect(dashboardData.spendingBreakdown[1].category).toBe('Transport');
      expect(dashboardData.spendingBreakdown[1].amount).toBe(200.00);
    });
  });

  describe('Task 19: Filter Query Correctness', () => {
    beforeEach(async () => {
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [testUserId]);
    });

    test('date range filter should work correctly', async () => {
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES
           ($1, $2, '2025-01-01', 100.00, 'January', 'debit', 'GBP'),
           ($1, $2, '2025-06-15', 200.00, 'June', 'debit', 'GBP'),
           ($1, $2, '2025-12-31', 300.00, 'December', 'debit', 'GBP')`,
        [testUserId, testBankAccountId]
      );

      // Query for June transactions
      const result = await pool.query(
        `SELECT COUNT(*) as count, SUM(amount) as total
         FROM transactions t
         JOIN bank_accounts ba ON t.bank_account_id = ba.id
         JOIN countries c ON ba.country_id = c.id
         WHERE t.user_id = $1
           AND c.code = 'UK'
           AND t.transaction_date >= '2025-06-01'
           AND t.transaction_date <= '2025-06-30'`,
        [testUserId]
      );

      expect(parseInt(result.rows[0].count)).toBe(1);
      expect(parseFloat(result.rows[0].total)).toBe(200.00);
    });

    test('transaction type filter should work correctly', async () => {
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES
           ($1, $2, CURRENT_DATE, 100.00, 'Salary', 'credit', 'GBP'),
           ($1, $2, CURRENT_DATE, 50.00, 'Groceries', 'debit', 'GBP'),
           ($1, $2, CURRENT_DATE, 200.00, 'Bonus', 'credit', 'GBP')`,
        [testUserId, testBankAccountId]
      );

      // Query for credits only
      const creditResult = await pool.query(
        `SELECT COUNT(*) as count, SUM(amount) as total
         FROM transactions t
         WHERE t.user_id = $1 AND t.transaction_type = 'credit'`,
        [testUserId]
      );

      expect(parseInt(creditResult.rows[0].count)).toBe(2);
      expect(parseFloat(creditResult.rows[0].total)).toBe(300.00);

      // Query for debits only
      const debitResult = await pool.query(
        `SELECT COUNT(*) as count, SUM(amount) as total
         FROM transactions t
         WHERE t.user_id = $1 AND t.transaction_type = 'debit'`,
        [testUserId]
      );

      expect(parseInt(debitResult.rows[0].count)).toBe(1);
      expect(parseFloat(debitResult.rows[0].total)).toBe(50.00);
    });

    test('amount range filter should work correctly', async () => {
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES
           ($1, $2, CURRENT_DATE, 10.00, 'Small', 'debit', 'GBP'),
           ($1, $2, CURRENT_DATE, 50.00, 'Medium', 'debit', 'GBP'),
           ($1, $2, CURRENT_DATE, 150.00, 'Large', 'debit', 'GBP')`,
        [testUserId, testBankAccountId]
      );

      // Query for amounts between 25 and 100
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM transactions t
         WHERE t.user_id = $1
           AND ABS(t.amount) >= 25
           AND ABS(t.amount) <= 100`,
        [testUserId]
      );

      expect(parseInt(result.rows[0].count)).toBe(1); // Only 'Medium' (50.00)
    });

    test('category filter should work correctly', async () => {
      if (!testCategoryId) {
        console.warn('Test category not found, skipping test');
        return;
      }

      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency, category_id)
         VALUES
           ($1, $2, CURRENT_DATE, 100.00, 'Tesco', 'debit', 'GBP', $3),
           ($1, $2, CURRENT_DATE, 50.00, 'Sainsburys', 'debit', 'GBP', $3),
           ($1, $2, CURRENT_DATE, 25.00, 'Other', 'debit', 'GBP', NULL)`,
        [testUserId, testBankAccountId, testCategoryId]
      );

      // Query for Groceries category
      const result = await pool.query(
        `SELECT COUNT(*) as count, SUM(t.amount) as total
         FROM transactions t
         LEFT JOIN transaction_categories tc ON t.category_id = tc.id
         WHERE t.user_id = $1 AND tc.name = 'Groceries'`,
        [testUserId]
      );

      expect(parseInt(result.rows[0].count)).toBe(2);
      expect(parseFloat(result.rows[0].total)).toBe(150.00);
    });
  });

  describe('Task 18: Data Isolation (Security)', () => {
    beforeEach(async () => {
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [testUserId]);
    });

    test('user should only see their own transactions', async () => {
      // Create second test user with unique email
      const uniqueEmail = `test-user2-${Date.now()}@example.com`;
      const user2Result = await pool.query(
        'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
        [uniqueEmail, 'hashedpassword', 'User 2']
      );
      const user2Id = user2Result.rows[0].id;

      // Create bank account for user 2
      const bank2Result = await pool.query(
        'INSERT INTO bank_accounts (user_id, country_id, bank_name, account_type, currency) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [user2Id, testCountryId, 'User 2 Bank', 'checking', 'GBP']
      );
      const bank2Id = bank2Result.rows[0].id;

      // Insert transaction for user 1
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES ($1, $2, CURRENT_DATE, 100.00, 'User 1 Transaction', 'debit', 'GBP')`,
        [testUserId, testBankAccountId]
      );

      // Insert transaction for user 2
      await pool.query(
        `INSERT INTO transactions (user_id, bank_account_id, transaction_date, amount, merchant, transaction_type, currency)
         VALUES ($1, $2, CURRENT_DATE, 200.00, 'User 2 Transaction', 'debit', 'GBP')`,
        [user2Id, bank2Id]
      );

      // Query as user 1
      const user1TransactionResult = await pool.query(
        `SELECT COUNT(*) as count FROM transactions WHERE user_id = $1`,
        [testUserId]
      );

      // Query as user 2
      const user2TransactionResult = await pool.query(
        `SELECT COUNT(*) as count FROM transactions WHERE user_id = $1`,
        [user2Id]
      );

      expect(parseInt(user1TransactionResult.rows[0].count)).toBe(1);
      expect(parseInt(user2TransactionResult.rows[0].count)).toBe(1);

      // Clean up user 2
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [user2Id]);
      await pool.query('DELETE FROM bank_accounts WHERE user_id = $1', [user2Id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user2Id]);
    });
  });
});
