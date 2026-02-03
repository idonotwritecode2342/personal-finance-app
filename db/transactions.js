const pool = require('./connection');

async function insertTransactions(userId, transactions, bankAccountId) {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const duplicateCheckQuery = `
    SELECT id FROM transactions
    WHERE bank_account_id = $1
      AND transaction_date = $2
      AND amount = $3
      AND (description = $4 OR merchant = $5)
    LIMIT 1
  `;

  const insertQuery = `
    INSERT INTO transactions (
      user_id, bank_account_id, transaction_date, amount, currency,
      description, merchant, transaction_type, category_id, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING id, transaction_date, amount, merchant, category_id
  `;

  const results = [];
  let skippedDuplicates = 0;

  for (const tx of transactions) {
    try {
      // Check for duplicate
      const duplicateCheck = await pool.query(duplicateCheckQuery, [
        bankAccountId,
        tx.date,
        tx.amount,
        tx.description || '',
        tx.merchant || ''
      ]);

      if (duplicateCheck.rows.length > 0) {
        // Transaction already exists, skip it
        skippedDuplicates++;
        continue;
      }

      // Insert new transaction
      const result = await pool.query(insertQuery, [
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

  console.log(`Inserted ${results.length} new transactions, skipped ${skippedDuplicates} duplicates`);
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
