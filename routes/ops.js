const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractTextFromPDF } = require('../lib/pdf-extractor');
const { detectBank } = require('../lib/bank-detector');
const { assignCategoriesToTransactions } = require('../lib/llm-extractor');

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
      country: 'UK', // Default to UK, can be overridden in bank confirmation
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
router.post('/upload/confirm-bank', async (req, res) => {
  try {
    const { institutionId } = req.body;

    console.log('Bank confirmation - institutionId:', institutionId);
    console.log('Session uploadState exists:', !!req.session.uploadState);

    if (!req.session.uploadState) {
      return res.status(400).json({ error: 'No upload in progress' });
    }

    // Fetch institution details to get bank name and country
    const institutionResult = await pool.query(`
      SELECT i.id, i.name as bank_name, c.code as country_code, c.name as country_name
      FROM institutions i
      JOIN countries c ON i.country_id = c.id
      WHERE i.id = $1
    `, [institutionId]);

    console.log('Institution query result:', institutionResult.rows);

    if (!institutionResult.rows[0]) {
      console.error('Institution not found for ID:', institutionId);
      return res.status(400).json({ error: 'Invalid institution selected' });
    }

    const institution = institutionResult.rows[0];

    console.log('Setting institution:', institution);

    req.session.uploadState.institutionId = parseInt(institutionId);
    req.session.uploadState.bank = institution.bank_name;
    req.session.uploadState.country = institution.country_code;
    req.session.uploadState.step = 3; // Move to Step 3: Transaction Preview

    console.log('Session uploadState after confirmation:', req.session.uploadState);

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
const { insertTransactions } = require('../db/transactions');
const pool = require('../db/connection');
const { getModel, setModel } = require('../lib/ai/model-config');
const axios = require('axios');
const { getModel, setModel } = require('../lib/ai/model-config');

function buildFeedback(query) {
  if (!query.status || !query.message) {
    return null;
  }
  return {
    status: query.status,
    message: query.message
  };
}

// GET /ops - Ops landing page
router.get('/', async (req, res) => {
  try {
    const [categoriesResult, accountsResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM transaction_categories'),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM bank_accounts
         WHERE user_id = $1`,
        [req.session.userId]
      )
    ]);

    res.render('ops/index', {
      title: 'Ops',
      totalCategories: categoriesResult.rows[0].count,
      totalAccounts: accountsResult.rows[0].count
    });
  } catch (err) {
    console.error('Ops home error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /ops/settings - Render global settings page
router.get('/settings', async (req, res) => {
  try {
    const currentModel = await getModel();
    res.render('ops/settings', {
      title: 'Settings',
      currentPage: 'settings',
      currentModel
    });
  } catch (err) {
    console.error('Ops settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /ops/settings/models - Fetch models from OpenRouter (filtered)
router.get('/settings/models', async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ error: 'OPENROUTER_API_KEY not configured' });
    }
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
    });
    const allowVendors = ['openai', 'anthropic', 'google'];
    const models = (response.data?.data || []).filter(m => {
      const id = m.id || '';
      return allowVendors.some(v => id.startsWith(v + '/'));
    });
    res.json({ models });
  } catch (err) {
    console.error('Model fetch error:', err.message);
    res.status(500).json({ error: 'Unable to load models' });
  }
});

// POST /ops/settings/model - Save selected model id
router.post('/settings/model', async (req, res) => {
  try {
    const { modelId } = req.body || {};
    if (!modelId) return res.status(400).json({ error: 'modelId is required' });
    await setModel(modelId);
    res.json({ success: true, modelId });
  } catch (err) {
    console.error('Model save error:', err.message);
    res.status(500).json({ error: 'Unable to save model' });
  }
});

// GET /ops/institutions - Get banks grouped by country
router.get('/institutions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        i.id,
        i.name,
        i.institution_type,
        c.code as country_code,
        c.name as country_name,
        c.currency_code
      FROM institutions i
      JOIN countries c ON i.country_id = c.id
      WHERE i.is_active = true AND i.institution_type = 'bank'
      ORDER BY c.name, i.name
    `);

    // Group by country
    const institutionsByCountry = {};
    result.rows.forEach(row => {
      if (!institutionsByCountry[row.country_code]) {
        institutionsByCountry[row.country_code] = {
          country: row.country_name,
          currency: row.currency_code,
          banks: []
        };
      }
      institutionsByCountry[row.country_code].banks.push({
        id: row.id,
        name: row.name
      });
    });

    res.json(institutionsByCountry);
  } catch (err) {
    console.error('Institutions fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ops/upload/extract-transactions - Extract from LLM
router.post('/upload/extract-transactions', async (req, res) => {
  try {
    if (!req.session.uploadState) {
      return res.status(400).json({ error: 'No upload in progress' });
    }

    const { statementText } = req.session.uploadState;
    const extracted = await extractTransactionsFromText(statementText);
    const transactions = extracted.transactions || [];

    // Auto-assign categories to transactions
    const categorizedTransactions = await assignCategoriesToTransactions(transactions);

    req.session.uploadState.extractedTransactions = categorizedTransactions;
    req.session.uploadState.step = 3;

    res.json({
      success: true,
      step: 3,
      transactions: categorizedTransactions,
      count: categorizedTransactions.length
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

    const { userId, extractedTransactions, bank, country, institutionId } = req.session.uploadState;

    // Validate country and institution
    if (!country) {
      return res.status(400).json({ error: 'Country not specified. Please select a bank first.' });
    }

    if (!institutionId) {
      return res.status(400).json({ error: 'Institution not specified. Please select a bank.' });
    }

    // Get institution and country info
    const institutionResult = await pool.query(
      `SELECT i.id, i.name, c.id as country_id, c.code as country_code, c.currency_code
       FROM institutions i
       JOIN countries c ON i.country_id = c.id
       WHERE i.id = $1`,
      [institutionId]
    );

    if (!institutionResult.rows[0]) {
      return res.status(400).json({ error: 'Institution not found' });
    }

    const institution = institutionResult.rows[0];

    // Create or get bank account
    let bankAccountId;
    const bankResult = await pool.query(
      `SELECT id FROM bank_accounts
       WHERE user_id = $1 AND institution_id = $2`,
      [userId, institutionId]
    );

    if (bankResult.rows.length > 0) {
      bankAccountId = bankResult.rows[0].id;
    } else {
      const newBankResult = await pool.query(
        `INSERT INTO bank_accounts (user_id, country_id, institution_id, bank_name, account_type, currency, confirmed)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id`,
        [userId, institution.country_id, institutionId, institution.name, 'checking', institution.currency_code]
      );

      if (!newBankResult.rows[0]) {
        return res.status(500).json({ error: 'Failed to create bank account' });
      }

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
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: err.message || 'Unknown error during import' });
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
      categories: categories.rows,
      feedback: buildFeedback(req.query)
    });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ops/categories - Create custom category
router.post('/categories', async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const description = req.body.description?.trim() || null;

    if (!name) {
      return res.redirect('/ops/categories?status=error&message=Category%20name%20is%20required');
    }

    await pool.query(
      `INSERT INTO transaction_categories (name, description, system_defined)
       VALUES ($1, $2, false)`,
      [name, description]
    );

    return res.redirect('/ops/categories?status=success&message=Category%20created');
  } catch (err) {
    if (err.code === '23505') {
      return res.redirect('/ops/categories?status=error&message=Category%20already%20exists');
    }
    console.error('Create category error:', err);
    return res.redirect('/ops/categories?status=error&message=Failed%20to%20create%20category');
  }
});

// POST /ops/categories/:id/delete - Delete custom category
router.post('/categories/:id/delete', async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    if (!Number.isInteger(categoryId)) {
      return res.redirect('/ops/categories?status=error&message=Invalid%20category');
    }

    const categoryResult = await pool.query(
      'SELECT id, system_defined FROM transaction_categories WHERE id = $1',
      [categoryId]
    );

    if (categoryResult.rows.length === 0) {
      return res.redirect('/ops/categories?status=error&message=Category%20not%20found');
    }

    if (categoryResult.rows[0].system_defined) {
      return res.redirect('/ops/categories?status=error&message=System%20categories%20cannot%20be%20deleted');
    }

    const usageResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM transactions WHERE category_id = $1',
      [categoryId]
    );

    if (usageResult.rows[0].count > 0) {
      return res.redirect('/ops/categories?status=error&message=Category%20is%20in%20use');
    }

    await pool.query('DELETE FROM transaction_categories WHERE id = $1', [categoryId]);
    return res.redirect('/ops/categories?status=success&message=Category%20deleted');
  } catch (err) {
    console.error('Delete category error:', err);
    return res.redirect('/ops/categories?status=error&message=Failed%20to%20delete%20category');
  }
});

// GET /ops/banks - Bank account management page
router.get('/banks', async (req, res) => {
  try {
    // Fetch accounts with institution details
    const accounts = await pool.query(
      `SELECT 
        ba.id, 
        ba.bank_name, 
        ba.account_name,
        ba.account_type, 
        ba.account_number_masked, 
        ba.currency, 
        ba.is_active,
        ba.notes,
        ba.institution_id,
        c.code as country_code,
        c.name as country,
        i.name as institution_name,
        i.institution_type
       FROM bank_accounts ba
       JOIN countries c ON ba.country_id = c.id
       LEFT JOIN institutions i ON ba.institution_id = i.id
       WHERE ba.user_id = $1
       ORDER BY ba.created_at DESC`,
      [req.session.userId]
    );

    // Fetch institutions grouped by country
    const institutionsResult = await pool.query(
      `SELECT 
        i.id, 
        i.name, 
        i.institution_type,
        c.code as country_code,
        c.name as country_name,
        c.currency_code
       FROM institutions i
       JOIN countries c ON i.country_id = c.id
       WHERE i.is_active = true
       ORDER BY c.name, i.institution_type, i.name`
    );

    // Group institutions by country
    const institutionsByCountry = {};
    institutionsResult.rows.forEach(row => {
      if (!institutionsByCountry[row.country_code]) {
        institutionsByCountry[row.country_code] = {
          country: row.country_name,
          currency: row.currency_code,
          institutions: []
        };
      }
      institutionsByCountry[row.country_code].institutions.push({
        id: row.id,
        name: row.name,
        institution_type: row.institution_type
      });
    });

    res.render('ops/banks', {
      title: 'Accounts',
      subtitle: 'Manage your linked accounts',
      currentPage: 'banks',
      accounts: accounts.rows,
      institutionsByCountry,
      feedback: buildFeedback(req.query)
    });
  } catch (err) {
    console.error('Banks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ops/banks - Create account linked to institution
router.post('/banks', async (req, res) => {
  try {
    const institutionId = parseInt(req.body.institution_id);
    const accountName = req.body.account_name?.trim();
    const accountType = req.body.account_type;
    const accountNumberMasked = req.body.account_number_masked?.trim() || null;
    const notes = req.body.notes?.trim() || null;
    const isActive = req.body.is_active === 'on';

    if (!institutionId || !accountName) {
      return res.redirect('/ops/banks?status=error&message=Institution%20and%20account%20name%20are%20required');
    }

    const validAccountTypes = [
      'checking', 'savings', 'credit_card', 'loan',
      'nro', 'nre', 'fd',
      'brokerage', 'isa', 'sipp', 'pension', 'crypto',
      'other'
    ];
    if (!validAccountTypes.includes(accountType)) {
      return res.redirect('/ops/banks?status=error&message=Invalid%20account%20type');
    }

    // Get institution details (includes country and currency)
    const institutionResult = await pool.query(
      `SELECT i.id, i.name, c.id as country_id, c.currency_code
       FROM institutions i
       JOIN countries c ON i.country_id = c.id
       WHERE i.id = $1`,
      [institutionId]
    );

    if (institutionResult.rows.length === 0) {
      return res.redirect('/ops/banks?status=error&message=Invalid%20institution');
    }

    const institution = institutionResult.rows[0];

    await pool.query(
      `INSERT INTO bank_accounts
      (user_id, country_id, institution_id, bank_name, account_name, account_type, account_number_masked, currency, is_active, notes, confirmed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
      [
        req.session.userId,
        institution.country_id,
        institutionId,
        institution.name,  // Store institution name in bank_name for backwards compatibility
        accountName,
        accountType,
        accountNumberMasked,
        institution.currency_code,
        isActive,
        notes
      ]
    );

    return res.redirect('/ops/banks?status=success&message=Account%20added');
  } catch (err) {
    console.error('Create account error:', err);
    return res.redirect('/ops/banks?status=error&message=Failed%20to%20add%20account');
  }
});

// POST /ops/banks/:id/update - Update existing account
router.post('/banks/:id/update', async (req, res) => {
  try {
    const bankAccountId = Number(req.params.id);
    const accountName = req.body.account_name?.trim();
    const accountType = req.body.account_type;
    const accountNumberMasked = req.body.account_number_masked?.trim() || null;
    const notes = req.body.notes?.trim() || null;
    const isActive = req.body.is_active === 'on';

    if (!Number.isInteger(bankAccountId)) {
      return res.redirect('/ops/banks?status=error&message=Invalid%20account');
    }

    if (!accountName) {
      return res.redirect('/ops/banks?status=error&message=Account%20name%20is%20required');
    }

    const validAccountTypes = [
      'checking', 'savings', 'credit_card', 'loan',
      'nro', 'nre', 'fd',
      'brokerage', 'isa', 'sipp', 'pension', 'crypto',
      'other'
    ];
    if (!validAccountTypes.includes(accountType)) {
      return res.redirect('/ops/banks?status=error&message=Invalid%20account%20type');
    }

    const accountResult = await pool.query(
      'SELECT id FROM bank_accounts WHERE id = $1 AND user_id = $2',
      [bankAccountId, req.session.userId]
    );

    if (accountResult.rows.length === 0) {
      return res.redirect('/ops/banks?status=error&message=Account%20not%20found');
    }

    await pool.query(
      `UPDATE bank_accounts
       SET account_name = $1, account_type = $2, account_number_masked = $3, 
           is_active = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [accountName, accountType, accountNumberMasked, isActive, notes, bankAccountId]
    );

    return res.redirect('/ops/banks?status=success&message=Account%20updated');
  } catch (err) {
    console.error('Update account error:', err);
    return res.redirect('/ops/banks?status=error&message=Failed%20to%20update%20account');
  }
});

// POST /ops/banks/:id/delete - Delete account
router.post('/banks/:id/delete', async (req, res) => {
  try {
    const bankAccountId = Number(req.params.id);
    if (!Number.isInteger(bankAccountId)) {
      return res.redirect('/ops/banks?status=error&message=Invalid%20account');
    }

    // Check for existing transactions
    const usageResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM transactions WHERE bank_account_id = $1 AND user_id = $2',
      [bankAccountId, req.session.userId]
    );

    if (usageResult.rows[0].count > 0) {
      return res.redirect('/ops/banks?status=error&message=Cannot%20delete%20account%20with%20transactions');
    }

    await pool.query(
      'DELETE FROM bank_accounts WHERE id = $1 AND user_id = $2',
      [bankAccountId, req.session.userId]
    );

    return res.redirect('/ops/banks?status=success&message=Account%20deleted');
  } catch (err) {
    console.error('Delete account error:', err);
    return res.redirect('/ops/banks?status=error&message=Failed%20to%20delete%20account');
  }
});

module.exports = router;
