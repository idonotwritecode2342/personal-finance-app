const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractTextFromPDF } = require('../lib/pdf-extractor');
const { detectBank } = require('../lib/bank-detector');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return cb(new Error('File size exceeds 5MB limit'));
    }
    cb(null, true);
  }
});

// POST /ops/upload - Handle PDF file upload
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;

    // Extract text from PDF
    const statementText = await extractTextFromPDF(filePath);

    // Detect bank
    const bankDetection = detectBank(statementText);

    // Store in session for multi-step workflow
    req.session.uploadState = {
      filePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      statementText,
      bankDetection,
      userId: req.session.userId,
      step: 2 // Move to Step 2: Bank Confirmation
    };

    res.json({
      success: true,
      step: 2,
      bankDetection: bankDetection || { bank: null, confidence: 0 }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ops/upload/confirm-bank - Confirm bank selection
router.post('/upload/confirm-bank', (req, res) => {
  try {
    const { selectedBank, selectedCountry } = req.body;

    if (!req.session.uploadState) {
      return res.status(400).json({ error: 'No upload in progress' });
    }

    req.session.uploadState.bank = selectedBank;
    req.session.uploadState.country = selectedCountry;
    req.session.uploadState.step = 3; // Move to Step 3: Transaction Preview

    res.json({ success: true, step: 3 });
  } catch (err) {
    console.error('Bank confirmation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /ops/upload - Render upload page
router.get('/upload', (req, res) => {
  res.render('ops/upload', {
    title: 'Upload Bank Statement',
    currentPage: 'upload',
    currentStep: req.session.uploadState?.step || 1
  });
});

const { extractTransactionsFromText } = require('../lib/llm-extractor');
const { insertTransactions, getCategoryByName } = require('../db/transactions');
const pool = require('../db/connection');

// POST /ops/upload/extract-transactions - Extract from LLM
router.post('/upload/extract-transactions', async (req, res) => {
  try {
    if (!req.session.uploadState) {
      return res.status(400).json({ error: 'No upload in progress' });
    }

    const { statementText } = req.session.uploadState;
    const extracted = await extractTransactionsFromText(statementText);
    req.session.uploadState.extractedTransactions = extracted.transactions || [];
    req.session.uploadState.step = 3;

    res.json({
      success: true,
      step: 3,
      transactions: extracted.transactions || [],
      count: (extracted.transactions || []).length
    });
  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /ops/preview - Preview extracted transactions
router.get('/preview', (req, res) => {
  try {
    if (!req.session.uploadState || !req.session.uploadState.extractedTransactions) {
      return res.redirect('/ops/upload');
    }

    const { extractedTransactions, bank, country } = req.session.uploadState;

    res.render('ops/preview', {
      title: 'Review Transactions',
      transactions: extractedTransactions,
      bank,
      country,
      count: extractedTransactions.length
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ops/upload/skip-transactions - Mark transactions to skip
router.post('/upload/skip-transactions', (req, res) => {
  try {
    const { skippedIds } = req.body;

    if (!req.session.uploadState) {
      return res.status(400).json({ error: 'No upload in progress' });
    }

    req.session.uploadState.skippedTransactionIds = skippedIds || [];
    req.session.uploadState.step = 4;

    res.json({ success: true, step: 4 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ops/categories-review - Category review page
router.get('/categories-review', async (req, res) => {
  try {
    if (!req.session.uploadState || !req.session.uploadState.extractedTransactions) {
      return res.redirect('/ops/upload');
    }

    const { extractedTransactions } = req.session.uploadState;

    // Fetch categories from database
    const categoriesResult = await pool.query(
      'SELECT id, name FROM transaction_categories ORDER BY name ASC'
    );

    res.render('ops/categories-review', {
      title: 'Review Categories',
      transactions: extractedTransactions,
      categories: categoriesResult.rows,
      currentStep: 4
    });
  } catch (err) {
    console.error('Categories review error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /upload/confirm - Final confirmation and save
router.post('/upload/confirm', async (req, res) => {
  try {
    const { categorizedTransactions } = req.body;

    if (!req.session.uploadState) {
      return res.status(400).json({ error: 'No upload in progress' });
    }

    const { userId, extractedTransactions, bank, country } = req.session.uploadState;

    // Create or get bank account
    let bankAccountId;
    const bankResult = await pool.query(
      `SELECT id FROM bank_accounts
       WHERE user_id = $1 AND LOWER(bank_name) = LOWER($2) AND country_id = (SELECT id FROM countries WHERE code = $3)`,
      [userId, bank, country]
    );

    if (bankResult.rows.length > 0) {
      bankAccountId = bankResult.rows[0].id;
    } else {
      const countryResult = await pool.query(
        'SELECT id FROM countries WHERE code = $1',
        [country]
      );

      const newBankResult = await pool.query(
        `INSERT INTO bank_accounts (user_id, country_id, bank_name, account_type, currency, confirmed)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id`,
        [userId, countryResult.rows[0].id, bank, 'checking', country === 'UK' ? 'GBP' : 'INR']
      );

      bankAccountId = newBankResult.rows[0].id;
    }

    // Merge categorized data with extracted transactions
    const transactionsToSave = extractedTransactions.map((tx, idx) => {
      const categorizedTx = categorizedTransactions[idx];
      return {
        ...tx,
        category_id: categorizedTx?.category_id || null,
        currency: country === 'UK' ? 'GBP' : 'INR'
      };
    });

    // Insert transactions
    const inserted = await insertTransactions(userId, transactionsToSave, bankAccountId);

    // Record PDF upload
    await pool.query(
      `INSERT INTO pdf_uploads (user_id, bank_account_id, file_name, bank_detected, transaction_count, upload_status)
       VALUES ($1, $2, $3, $4, $5, 'processed')`,
      [userId, bankAccountId, req.session.uploadState.fileName, bank, inserted.length]
    );

    // Clear session
    delete req.session.uploadState;

    res.json({
      success: true,
      transactionsImported: inserted.length,
      redirect: '/dashboard?imported=' + inserted.length
    });
  } catch (err) {
    console.error('Confirmation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /ops/categories - Category management page
router.get('/categories', async (req, res) => {
  try {
    const categories = await pool.query(
      'SELECT id, name, description, system_defined FROM transaction_categories ORDER BY system_defined DESC, name ASC'
    );

    res.render('ops/categories', {
      title: 'Categories',
      subtitle: 'Manage transaction categories',
      currentPage: 'categories',
      categories: categories.rows
    });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /ops/banks - Bank account management page
router.get('/banks', async (req, res) => {
  try {
    const accounts = await pool.query(
      `SELECT ba.id, ba.bank_name, ba.account_type, ba.currency, ba.confirmed, c.name as country
       FROM bank_accounts ba
       JOIN countries c ON ba.country_id = c.id
       WHERE ba.user_id = $1
       ORDER BY ba.created_at DESC`,
      [req.session.userId]
    );

    res.render('ops/banks', {
      title: 'Bank Accounts',
      subtitle: 'Manage your linked bank accounts',
      currentPage: 'banks',
      accounts: accounts.rows
    });
  } catch (err) {
    console.error('Banks error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
