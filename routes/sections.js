const express = require('express');

const router = express.Router();

function renderSectionPage(res, pageKey, title, subtitle) {
  return res.render('section-page', {
    title,
    subtitle,
    pageKey
  });
}

router.get('/analytics', (req, res) => renderSectionPage(res, 'analytics', 'Analytics', 'Insights and trends are coming here.'));
router.get('/agent', (req, res) => renderSectionPage(res, 'agent', 'Agent', 'AI-driven actions and guidance will live here.'));
router.get('/investments', (req, res) => renderSectionPage(res, 'investments', 'Investments', 'Track and manage your portfolio here.'));
router.get('/goals', (req, res) => renderSectionPage(res, 'goals', 'Goals', 'Set and monitor your financial targets here.'));

module.exports = router;
