const express = require('express');
const pool = require('../db/connection');
const { getDashboardData } = require('../db/dashboard');

const router = express.Router();

// GET dashboard - Mission Control Net Worth view
router.get('/', async (req, res) => {
  try {
    const countryCode = req.query.country || 'UK';
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect('/login');
    }

    // Task 15: Fetch real dashboard data from database
    const dashboardData = await getDashboardData(userId, countryCode);

    res.render('dashboard', {
      title: 'Mission Control Dashboard',
      country: countryCode,
      userEmail: req.session.userEmail,
      pageKey: 'dashboard',
      dashboardData: dashboardData
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('error', { title: 'Error', message: 'Could not load dashboard' });
  }
});

// Helper function: Calculate date range for presets
function calculateDateRange(preset, fromDate, toDate) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  switch (preset) {
    case 'last7days':
      return {
        from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: today.toISOString().split('T')[0]
      };

    case 'last30days':
      return {
        from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: today.toISOString().split('T')[0]
      };

    case 'thisMonth':
      return {
        from: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
        to: today.toISOString().split('T')[0]
      };

    case 'lastMonth':
      const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
      const lastMonthYear = lastMonthDate.getFullYear();
      const lastMonthNum = lastMonthDate.getMonth() + 1;
      const lastDayOfMonth = new Date(lastMonthYear, lastMonthNum, 0).getDate();
      return {
        from: `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-01`,
        to: `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
      };

    case 'lastQuarter':
      const quarter = Math.floor(currentMonth / 3);
      const quarterStart = quarter - 1;
      const quarterStartMonth = quarterStart * 3;
      const quarterStartYear = quarterStart < 0 ? currentYear - 1 : currentYear;
      const quarterStartMonthAdjusted = quarterStart < 0 ? quarterStartMonth + 12 : quarterStartMonth;
      const quarterEndDate = new Date(quarterStartYear, quarterStartMonthAdjusted + 3, 0);
      return {
        from: `${quarterStartYear}-${String(quarterStartMonthAdjusted + 1).padStart(2, '0')}-01`,
        to: quarterEndDate.toISOString().split('T')[0]
      };

    case 'thisYear':
      return {
        from: `${currentYear}-01-01`,
        to: today.toISOString().split('T')[0]
      };

    case 'lastYear':
      return {
        from: `${currentYear - 1}-01-01`,
        to: `${currentYear - 1}-12-31`
      };

    case 'custom':
      // Validate custom dates
      if (!fromDate || !toDate) {
        throw new Error('Custom date range requires both fromDate and toDate');
      }
      return { from: fromDate, to: toDate };

    default:
      return { from: null, to: null };
  }
}

// GET /transactions - View all transactions with filters
router.get('/transactions', async (req, res) => {
  try {
    const { category, datePreset = 'all', fromDate, toDate, minAmount, maxAmount, transactionType = 'all', page = '1', country = 'UK' } = req.query;
    const pageSize = 50;

    // Validate and sanitize page number (Task 8: Fix SQL injection vulnerability)
    const pageNum = Math.max(1, Math.min(1000, parseInt(page) || 1));
    const offset = (pageNum - 1) * pageSize;

    // Calculate date range based on preset (Task 6: Date preset logic)
    let finalFromDate = null;
    let finalToDate = null;
    try {
      if (datePreset && datePreset !== 'all') {
        const dateRange = calculateDateRange(datePreset, fromDate, toDate);
        finalFromDate = dateRange.from;
        finalToDate = dateRange.to;
      } else if (fromDate || toDate) {
        finalFromDate = fromDate || null;
        finalToDate = toDate || null;
      }
    } catch (err) {
      console.error('Date range calculation error:', err);
      return res.render('error', { title: 'Error', message: 'Invalid date range' });
    }

    // Build WHERE clause with all filters
    let whereConditions = ['t.user_id = $1'];
    let params = [req.session.userId];
    let paramIndex = 2;

    // Task 5: Add transaction type filter
    if (transactionType && transactionType !== 'all') {
      whereConditions.push(`t.transaction_type = $${paramIndex}`);
      params.push(transactionType);
      paramIndex++;
    }

    // Add category filter
    if (category && category !== 'all') {
      whereConditions.push(`tc.name = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Add date filters
    if (finalFromDate) {
      whereConditions.push(`t.transaction_date >= $${paramIndex}`);
      params.push(finalFromDate);
      paramIndex++;
    }

    if (finalToDate) {
      whereConditions.push(`t.transaction_date <= $${paramIndex}`);
      params.push(finalToDate);
      paramIndex++;
    }

    // Add amount filters
    if (minAmount) {
      whereConditions.push(`ABS(t.amount) >= $${paramIndex}`);
      params.push(Math.abs(parseFloat(minAmount)));
      paramIndex++;
    }

    if (maxAmount) {
      whereConditions.push(`ABS(t.amount) <= $${paramIndex}`);
      params.push(Math.abs(parseFloat(maxAmount)));
      paramIndex++;
    }

    // Add country filtering (Task 4 fix: filter by country)
    whereConditions.push(`c.code = $${paramIndex}`);
    params.push(country);
    paramIndex++;

    const whereClause = whereConditions.join(' AND ');

    // Build main query with country join
    let query = `
      SELECT
        t.id, t.transaction_date, t.amount, t.currency,
        t.description, t.merchant, t.transaction_type,
        tc.name as category,
        ba.bank_name, ba.id as bank_id
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      JOIN bank_accounts ba ON t.bank_account_id = ba.id
      JOIN countries c ON ba.country_id = c.id
      WHERE ${whereClause}
    `;

    // Task 7: P&L calculation query
    const plQuery = `
      SELECT
        SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE -t.amount END) as net_pl
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      JOIN bank_accounts ba ON t.bank_account_id = ba.id
      JOIN countries c ON ba.country_id = c.id
      WHERE ${whereClause}
    `;

    // Task 8: Fix count query - use identical WHERE clause
    const countQuery = `
      SELECT COUNT(*) as count
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      JOIN bank_accounts ba ON t.bank_account_id = ba.id
      JOIN countries c ON ba.country_id = c.id
      WHERE ${whereClause}
    `;

    // Execute P&L query
    const plResult = await pool.query(plQuery, params);
    const netPL = parseFloat(plResult.rows[0]?.net_pl || 0);

    // Get total count (Task 8: Fixed SQL injection)
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0]?.count || 0);
    const totalPages = Math.ceil(totalCount / pageSize);

    // Add pagination to main query (Task 8: Fixed SQL injection with parameterized LIMIT/OFFSET)
    query += ` ORDER BY t.transaction_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, offset);

    const result = await pool.query(query, params);

    // Get all categories for filter dropdown (Task 4 fix: filter by user_id)
    const categoriesResult = await pool.query(
      'SELECT DISTINCT tc.name FROM transaction_categories tc WHERE tc.user_id IS NULL OR tc.user_id = $1 ORDER BY tc.name',
      [req.session.userId]
    );

    // Task 9: Update response with new data
    res.render('transactions', {
      title: 'All Transactions',
      transactions: result.rows,
      categories: categoriesResult.rows.map(r => r.name),
      currentCategory: category || 'all',
      datePreset: datePreset || 'all',
      finalFromDate: finalFromDate || '',
      finalToDate: finalToDate || '',
      fromDate: fromDate || '',
      toDate: toDate || '',
      minAmount: minAmount || '',
      maxAmount: maxAmount || '',
      transactionType: transactionType || 'all',
      netPL: netPL,
      page: pageNum,
      totalPages: totalPages,
      totalCount: totalCount,
      country: country,
      pageKey: 'transactions'
    });
  } catch (err) {
    console.error('Transactions view error:', err);
    res.render('error', { title: 'Error', message: 'Could not load transactions' });
  }
});

module.exports = router;
