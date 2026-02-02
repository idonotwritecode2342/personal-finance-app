const express = require('express');
const pool = require('../db/connection');

const router = express.Router();

/**
 * Parse date filter to get start and end dates
 * @param {string} filter - One of: last_7_days, this_month, last_month, this_year
 * @returns {{startDate: string, endDate: string}} - ISO date strings
 */
function parseDateFilter(filter) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const date = today.getDate();

  let startDate, endDate;
  endDate = today.toISOString().split('T')[0]; // Today

  switch (filter) {
    case 'last_7_days':
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      startDate = new Date(year, month, 1);
      break;
    case 'last_month':
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0).toISOString().split('T')[0];
      break;
    case 'this_year':
      startDate = new Date(year, 0, 1);
      break;
    default:
      // Default to this month
      startDate = new Date(year, month, 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate
  };
}

/**
 * Get Sankey data: Income flows → Category spending
 * Returns aggregated transactions grouped by month and category
 */
router.get('/sankey', async (req, res) => {
  try {
    const { filter = 'this_month', country = 'UK' } = req.query;
    const userId = req.session.userId;

    // Parse date filter
    const { startDate, endDate } = parseDateFilter(filter);

    // Query to get transactions grouped by month and category
    // Groups income separately from expenses
    const query = `
      SELECT
        DATE_TRUNC('month', t.transaction_date)::date as month,
        tc.name as category,
        tc.is_income,
        tc.color,
        tc.icon,
        SUM(ABS(t.amount)) as total_amount,
        COUNT(t.id) as transaction_count
      FROM transactions t
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      JOIN bank_accounts ba ON t.bank_account_id = ba.id
      JOIN countries c ON ba.country_id = c.id
      WHERE t.user_id = $1
        AND t.transaction_date >= $2
        AND t.transaction_date <= $3
        AND c.code = $4
        AND t.is_excluded = FALSE
      GROUP BY DATE_TRUNC('month', t.transaction_date), tc.name, tc.is_income, tc.color, tc.icon
      ORDER BY month ASC, tc.is_income DESC, total_amount DESC
    `;

    const result = await pool.query(query, [userId, startDate, endDate, country]);

    // Transform to Sankey format
    // Structure: months -> categories, with income and expense flows
    const sankeyData = transformToSankey(result.rows);

    res.json({
      success: true,
      filter,
      country,
      dateRange: { startDate, endDate },
      data: sankeyData,
      rawData: result.rows // Include raw data for debugging
    });
  } catch (err) {
    console.error('Sankey data error:', err);
    res.status(500).json({
      success: false,
      error: 'Could not load sankey data',
      message: err.message
    });
  }
});

/**
 * Transform aggregated transaction data into Sankey diagram format
 * Creates nodes for: months, income/expense totals, categories
 * Creates links showing flows between them
 */
function transformToSankey(rows) {
  if (!rows || rows.length === 0) {
    return { nodes: [], links: [] };
  }

  const nodes = [];
  const links = [];
  const nodeMap = new Map(); // Track node indices by name

  // Helper to add unique node
  function addNode(name, type, color = '#b0b0b0', icon = '') {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, {
        id: nodes.length,
        name,
        type,
        color,
        icon,
        value: 0 // Will aggregate
      });
      nodes.push(nodeMap.get(name));
    }
    return nodeMap.get(name).id;
  }

  // Group transactions by month
  const monthlyData = new Map();
  rows.forEach(row => {
    const month = row.month ? new Date(row.month).toISOString().split('T')[0] : 'Uncategorized';
    if (!monthlyData.has(month)) {
      monthlyData.set(month, {
        income: 0,
        expenses: 0,
        categories: new Map()
      });
    }

    const monthData = monthlyData.get(month);
    const isIncome = row.is_income === true;

    if (isIncome) {
      monthData.income += parseFloat(row.total_amount || 0);
    } else {
      monthData.expenses += parseFloat(row.total_amount || 0);
    }

    // Track by category
    if (!monthData.categories.has(row.category)) {
      monthData.categories.set(row.category, {
        amount: 0,
        isIncome,
        color: row.color || '#b0b0b0',
        icon: row.icon || '',
        transactionCount: 0
      });
    }

    const catData = monthData.categories.get(row.category);
    catData.amount += parseFloat(row.total_amount || 0);
    catData.transactionCount += row.transaction_count;
  });

  // Build nodes and links
  // Month (source) -> Category -> Income/Expense totals

  monthlyData.forEach((monthData, month) => {
    const monthNodeId = addNode(
      `${month}`,
      'month',
      '#252525',
      '📅'
    );

    // Create links from month to each category
    monthData.categories.forEach((catData, categoryName) => {
      const categoryNodeId = addNode(
        categoryName,
        'category',
        catData.color,
        catData.icon
      );

      // Add link from month to category
      links.push({
        source: monthNodeId,
        target: categoryNodeId,
        value: parseFloat(catData.amount.toFixed(2)),
        isIncome: catData.isIncome
      });

      // Update category node value
      nodeMap.get(categoryName).value += parseFloat(catData.amount.toFixed(2));
    });
  });

  // Create income and expense summary nodes
  let totalIncome = 0;
  let totalExpense = 0;

  monthlyData.forEach((monthData) => {
    totalIncome += monthData.income;
    totalExpense += monthData.expenses;
  });

  const incomeNodeId = addNode('Total Income', 'summary', '#22c55e', '💰');
  const expenseNodeId = addNode('Total Expenses', 'summary', '#ef4444', '💸');

  // Create links from categories to income/expense summaries
  nodeMap.forEach((node, name) => {
    if (node.type === 'category') {
      // Determine if this category is income or expense based on data
      const isIncome = rows.some(r => r.category === name && r.is_income === true);

      if (isIncome) {
        links.push({
          source: node.id,
          target: incomeNodeId,
          value: node.value,
          isIncome: true
        });
      } else {
        links.push({
          source: node.id,
          target: expenseNodeId,
          value: node.value,
          isIncome: false
        });
      }
    }
  });

  // Filter out month nodes (we'll reconstruct flow differently for clarity)
  // Actually, keep them but reorder for better visualization
  const nodesArray = Array.from(nodeMap.values()).map(node => ({
    name: node.name,
    type: node.type,
    color: node.color,
    icon: node.icon,
    value: node.value > 0 ? node.value : undefined
  }));

  return {
    nodes: nodesArray,
    links: links.map(link => ({
      source: link.source,
      target: link.target,
      value: link.value
    })),
    summary: {
      totalIncome: parseFloat(totalIncome.toFixed(2)),
      totalExpense: parseFloat(totalExpense.toFixed(2)),
      netFlow: parseFloat((totalIncome - totalExpense).toFixed(2))
    }
  };
}

/**
 * GET /api/analytics - Main analytics page (renders view)
 */
router.get('/', async (req, res) => {
  try {
    const countryCode = req.query.country || 'UK';

    res.render('analytics', {
      title: 'Analytics',
      country: countryCode,
      userEmail: req.session.userEmail
    });
  } catch (err) {
    console.error('Analytics page error:', err);
    res.render('error', { title: 'Error', message: 'Could not load analytics page' });
  }
});

module.exports = router;
