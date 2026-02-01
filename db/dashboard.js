const pool = require('./connection');

// Get current spend for the month by country
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

// Get current income for the month by country
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

module.exports = {
  getCurrentSpend,
  getCurrentIncome,
  getSavingsBalance,
  getInvestmentBalance,
  getRecentTransactions,
};
