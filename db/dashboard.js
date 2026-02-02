const pool = require('./connection');

// LEGACY: Get current spend for the month by country
// NOTE: Uses INTERVAL '30 days' (last 30 days) instead of calendar month
// Kept for backwards compatibility with existing tests
// New code should use getMonthlySpend() which uses EXTRACT(YEAR/MONTH) for calendar month
async function getCurrentSpend(userId, countryCode) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(t.amount), 0) as total_spend
     FROM transactions t
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     WHERE t.user_id = $1
       AND c.code = $2
       AND t.transaction_type = 'debit'
       AND t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'`,
    [userId, countryCode]
  );

  return parseFloat(result.rows[0].total_spend);
}

// LEGACY: Get current income for the month by country
// NOTE: Uses INTERVAL '30 days' (last 30 days) instead of calendar month
// Kept for backwards compatibility with existing tests
// New code should use getMonthlyIncome() which uses EXTRACT(YEAR/MONTH) for calendar month
async function getCurrentIncome(userId, countryCode) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(t.amount), 0) as total_income
     FROM transactions t
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     WHERE t.user_id = $1
       AND c.code = $2
       AND t.transaction_type = 'credit'
       AND t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'`,
    [userId, countryCode]
  );

  return parseFloat(result.rows[0].total_income);
}

// Get savings balance by country
async function getSavingsBalance(userId, countryCode) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(
       CASE WHEN t.transaction_type = 'credit' THEN t.amount
            WHEN t.transaction_type = 'debit' THEN -t.amount
       END
     ), 0) as savings_balance
     FROM transactions t
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     WHERE t.user_id = $1
       AND c.code = $2
       AND ba.account_type = 'savings'`,
    [userId, countryCode]
  );

  return parseFloat(result.rows[0].savings_balance);
}

// Get investment balance by country
async function getInvestmentBalance(userId, countryCode) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(
       CASE WHEN t.transaction_type = 'credit' THEN t.amount
            WHEN t.transaction_type = 'debit' THEN -t.amount
       END
     ), 0) as investment_balance
     FROM transactions t
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     WHERE t.user_id = $1
       AND c.code = $2
       AND ba.account_type = 'investment'`,
    [userId, countryCode]
  );

  return parseFloat(result.rows[0].investment_balance);
}

// Get recent transactions by country
async function getRecentTransactions(userId, countryCode, limit = 10) {
  const result = await pool.query(
    `SELECT
       t.id, t.transaction_date, t.amount, t.merchant, t.description,
       tc.name as category, ba.bank_name, t.transaction_type
     FROM transactions t
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     LEFT JOIN transaction_categories tc ON t.category_id = tc.id
     WHERE t.user_id = $1 AND c.code = $2
     ORDER BY t.transaction_date DESC
     LIMIT $3`,
    [userId, countryCode, limit]
  );

  return result.rows;
}

// Task 15: Get monthly spending by category (current month) - top 4 categories
async function getMonthlyCategorySpending(userId, countryCode) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const result = await pool.query(
    `SELECT COALESCE(tc.name, 'Uncategorized') as category, COALESCE(SUM(t.amount), 0) as amount
     FROM transactions t
     LEFT JOIN transaction_categories tc ON t.category_id = tc.id
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     WHERE t.user_id = $1
       AND c.code = $2
       AND t.transaction_type = 'debit'
       AND EXTRACT(YEAR FROM t.transaction_date) = $3
       AND EXTRACT(MONTH FROM t.transaction_date) = $4
     GROUP BY tc.id, tc.name
     ORDER BY amount DESC
     LIMIT 4`,
    [userId, countryCode, currentYear, currentMonth]
  );

  return result.rows;
}

// Task 15: Get total monthly spend (current month)
async function getMonthlySpend(userId, countryCode) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const result = await pool.query(
    `SELECT COALESCE(SUM(t.amount), 0) as total_spend
     FROM transactions t
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     WHERE t.user_id = $1
       AND c.code = $2
       AND t.transaction_type = 'debit'
       AND EXTRACT(YEAR FROM t.transaction_date) = $3
       AND EXTRACT(MONTH FROM t.transaction_date) = $4`,
    [userId, countryCode, currentYear, currentMonth]
  );

  return parseFloat(result.rows[0]?.total_spend || 0);
}

// Task 15: Get monthly income (current month)
async function getMonthlyIncome(userId, countryCode) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const result = await pool.query(
    `SELECT COALESCE(SUM(t.amount), 0) as total_income
     FROM transactions t
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     WHERE t.user_id = $1
       AND c.code = $2
       AND t.transaction_type = 'credit'
       AND EXTRACT(YEAR FROM t.transaction_date) = $3
       AND EXTRACT(MONTH FROM t.transaction_date) = $4`,
    [userId, countryCode, currentYear, currentMonth]
  );

  return parseFloat(result.rows[0]?.total_income || 0);
}

// Task 15: Get 12-month trend (last 12 months spending)
async function getMonthlyTrend(userId, countryCode) {
  const result = await pool.query(
    `SELECT
       EXTRACT(YEAR FROM t.transaction_date)::int as year,
       EXTRACT(MONTH FROM t.transaction_date)::int as month,
       COALESCE(SUM(t.amount), 0) as total
     FROM transactions t
     JOIN bank_accounts ba ON t.bank_account_id = ba.id
     JOIN countries c ON ba.country_id = c.id
     WHERE t.user_id = $1
       AND c.code = $2
       AND t.transaction_type = 'debit'
       AND t.transaction_date >= NOW() - INTERVAL '12 months'
     GROUP BY year, month
     ORDER BY year ASC, month ASC`,
    [userId, countryCode]
  );

  // Convert to array of 12 values, filling in missing months with 0
  const monthlyData = {};
  result.rows.forEach(row => {
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
    monthlyData[key] = parseFloat(row.total);
  });

  // Generate last 12 months
  const trend = [];
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    trend.push(monthlyData[key] || 0);
  }

  return trend;
}

// Task 15: Get all dashboard data in one call
async function getDashboardData(userId, countryCode) {
  try {
    const [
      monthlySpend,
      monthlyIncome,
      categorySpending,
      monthlyTrend
    ] = await Promise.all([
      getMonthlySpend(userId, countryCode),
      getMonthlyIncome(userId, countryCode),
      getMonthlyCategorySpending(userId, countryCode),
      getMonthlyTrend(userId, countryCode)
    ]);

    // Calculate spending breakdown with percentages
    const spendingBreakdown = categorySpending.map(cat => ({
      category: cat.category,
      amount: parseFloat(cat.amount),
      percentage: monthlySpend > 0 ? (parseFloat(cat.amount) / monthlySpend) * 100 : 0
    }));

    // Calculate current savings (income - spend)
    const currentSavings = monthlyIncome - monthlySpend;

    return {
      monthlySpend,
      monthlyIncome,
      currentSavings: Math.max(0, currentSavings),
      spendingBreakdown,
      monthlyTrend
    };
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    // Return default empty data if queries fail
    return {
      monthlySpend: 0,
      monthlyIncome: 0,
      currentSavings: 0,
      spendingBreakdown: [],
      monthlyTrend: Array(12).fill(0)
    };
  }
}

module.exports = {
  getCurrentSpend,
  getCurrentIncome,
  getSavingsBalance,
  getInvestmentBalance,
  getRecentTransactions,
  getMonthlyCategorySpending,
  getMonthlySpend,
  getMonthlyIncome,
  getMonthlyTrend,
  getDashboardData,
};
