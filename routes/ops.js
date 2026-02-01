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
    currentStep: req.session.uploadState?.step || 1
  });
});

const { extractTransactionsFromText } = require('../lib/llm-extractor');

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

module.exports = router;
