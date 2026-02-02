const express = require('express');

const router = express.Router();

// GET dashboard - Mission Control Net Worth view
router.get('/', async (req, res) => {
  try {
    const countryCode = req.query.country || 'UK';

    res.render('dashboard', {
      title: 'Mission Control Dashboard',
      country: countryCode,
      userEmail: req.session.userEmail
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('error', { title: 'Error', message: 'Could not load dashboard' });
  }
});

// GET /transactions - View all transactions with filters
router.get('/transactions', async (req, res) => {
  try {
    const { category, fromDate, toDate, minAmount, maxAmount, page = 1 } = req.query;
    const pageSize = 50;
    const offset = (parseInt(page) - 1) * pageSize;

    // Build query
    let query = `
      SELECT
        t.id, t.transaction_date, t.amount, t.currency,
        t.description, t.merchant, t.transaction_type,
        tc.name as category,
        ba.bank_name, ba.id as bank_id
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      JOIN bank_accounts ba ON t.bank_account_id = ba.id
      WHERE t.user_id = $1
    `;

    let params = [req.session.userId];
    let paramIndex = 2;

    // Add filters
    if (category && category !== 'all') {
      query += ` AND tc.name = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (fromDate) {
      query += ` AND t.transaction_date >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      query += ` AND t.transaction_date <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }

    if (minAmount) {
      query += ` AND ABS(t.amount) >= $${paramIndex}`;
      params.push(Math.abs(parseFloat(minAmount)));
      paramIndex++;
    }

    if (maxAmount) {
      query += ` AND ABS(t.amount) <= $${paramIndex}`;
      params.push(Math.abs(parseFloat(maxAmount)));
      paramIndex++;
    }

    // Get total count
    const countResult = await pool.query(
      query.replace('SELECT t.id, t.transaction_date, t.amount, t.currency, t.description, t.merchant, t.transaction_type, tc.name as category, ba.bank_name, ba.id as bank_id FROM',
        'SELECT COUNT(*) as count FROM'),
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / pageSize);

    // Add pagination
    query += ` ORDER BY t.transaction_date DESC LIMIT ${pageSize} OFFSET ${offset}`;

    const result = await pool.query(query, params);

    // Get all categories for filter dropdown
    const categoriesResult = await pool.query(
      'SELECT DISTINCT name FROM transaction_categories ORDER BY name'
    );

    res.render('transactions', {
      title: 'All Transactions',
      transactions: result.rows,
      categories: categoriesResult.rows.map(r => r.name),
      currentCategory: category || 'all',
      fromDate: fromDate || '',
      toDate: toDate || '',
      minAmount: minAmount || '',
      maxAmount: maxAmount || '',
      page: parseInt(page),
      totalPages: totalPages,
      totalCount: totalCount
    });
  } catch (err) {
    console.error('Transactions view error:', err);
    res.render('error', { title: 'Error', message: 'Could not load transactions' });
  }
});

module.exports = router;
