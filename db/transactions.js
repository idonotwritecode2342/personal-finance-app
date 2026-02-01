const pool = require('./connection');

async function insertTransactions(userId, transactions, bankAccountId) {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const query = `
    INSERT INTO transactions (
      user_id, bank_account_id, transaction_date, amount, currency,
      description, merchant, transaction_type, category_id, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING id, transaction_date, amount, merchant, category_id
  `;

  const results = [];

  for (const tx of transactions) {
    try {
      const result = await pool.query(query, [
        userId,
        bankAccountId,
        tx.date,
        tx.amount,
        tx.currency || 'GBP',
        tx.description,
        tx.merchant,
        tx.transaction_type,
        tx.category_id || null
      ]);

      results.push(result.rows[0]);
    } catch (err) {
      console.error('Error inserting transaction:', err);
    }
  }

  return results;
}

async function getCategoryByName(categoryName) {
  const result = await pool.query(
    'SELECT id FROM transaction_categories WHERE LOWER(name) = LOWER($1)',
    [categoryName]
  );
  return result.rows[0];
}

module.exports = {
  insertTransactions,
  getCategoryByName
};
