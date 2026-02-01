const express = require('express');
const {
  getCurrentSpend,
  getCurrentIncome,
  getSavingsBalance,
  getInvestmentBalance,
  getRecentTransactions
} = require('../db/dashboard');

const router = express.Router();

// GET dashboard
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const countryCode = req.query.country || 'UK';

    // Get all dashboard data
    const [spend, income, savings, investments, recentTransactions] = await Promise.all([
      getCurrentSpend(userId, countryCode),
      getCurrentIncome(userId, countryCode),
      getSavingsBalance(userId, countryCode),
      getInvestmentBalance(userId, countryCode),
      getRecentTransactions(userId, countryCode)
    ]);

    // Determine currency based on country
    const currency = countryCode === 'UK' ? '£' : '₹';

    res.render('dashboard', {
      title: 'Dashboard',
      country: countryCode,
      currency,
      metrics: {
        spend: spend.toFixed(2),
        income: income.toFixed(2),
        savings: savings.toFixed(2),
        investments: investments.toFixed(2)
      },
      recentTransactions,
      userEmail: req.session.userEmail
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('error', { title: 'Error', message: 'Could not load dashboard' });
  }
});

module.exports = router;
