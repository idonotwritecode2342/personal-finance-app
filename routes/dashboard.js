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

module.exports = router;
