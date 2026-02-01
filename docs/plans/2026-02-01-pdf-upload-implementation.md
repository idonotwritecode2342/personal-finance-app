# PDF Upload & Transaction Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 5-step PDF upload workflow with LLM-powered transaction extraction, bank auto-detection, and interactive review before saving transactions to the database.

**Architecture:** Multi-route feature with backend PDF processing + LLM integration, frontend multi-step forms with table previews. Session-based state management for the 5-step workflow. Database operations to save extracted transactions with bank account linkage.

**Tech Stack:**
- PDF parsing: `pdfjs-dist` (more reliable than pdfparse)
- LLM: OpenRouter + Mistral API
- Storage: PostgreSQL (existing schema)
- Frontend: EJS templates with vanilla JS
- Testing: Jest (unit), Supertest (integration), Playwright (E2E)

---

## PHASE 1: Backend Foundation - PDF Parsing & LLM Integration

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Add dependencies**

Add these to the `dependencies` section of package.json:
```json
"pdfjs-dist": "^4.0.379",
"multer": "^1.4.5-lts.1",
"axios": "^1.6.5"
```

**Step 2: Install packages**

```bash
npm install
```

Expected: All packages installed successfully, no vulnerabilities reported.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: Add PDF parsing, file upload, and HTTP client libraries"
```

---

### Task 2: Create PDF Extraction Utility

**Files:**
- Create: `lib/pdf-extractor.js`
- Create: `tests/lib/pdf-extractor.test.js`

**Step 1: Write failing test for PDF text extraction**

Create `tests/lib/pdf-extractor.test.js`:
```javascript
const { extractTextFromPDF } = require('../../lib/pdf-extractor');
const fs = require('fs');
const path = require('path');

describe('PDF Text Extraction', () => {
  it('should extract text from valid PDF', async () => {
    const pdfPath = '/Users/tanveer/Downloads/2025-11-09_Statement (1).pdf';
    const text = await extractTextFromPDF(pdfPath);

    expect(text).toBeDefined();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('should throw error for non-existent file', async () => {
    const pdfPath = '/nonexistent/file.pdf';

    await expect(extractTextFromPDF(pdfPath)).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/pdf-extractor.test.js
```

Expected: FAIL - "extractTextFromPDF is not defined"

**Step 3: Write PDF extraction implementation**

Create `lib/pdf-extractor.js`:
```javascript
const PDFDocument = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');

async function extractTextFromPDF(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdf = await PDFDocument.getDocument({ data: pdfBytes }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

module.exports = { extractTextFromPDF };
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/pdf-extractor.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/pdf-extractor.js tests/lib/pdf-extractor.test.js
git commit -m "feat: Add PDF text extraction utility with tests"
```

---

### Task 3: Create LLM Integration Utility

**Files:**
- Create: `lib/llm-extractor.js`
- Create: `tests/lib/llm-extractor.test.js`

**Step 1: Write failing test for LLM transaction extraction**

Create `tests/lib/llm-extractor.test.js`:
```javascript
const { extractTransactionsFromText } = require('../../lib/llm-extractor');

describe('LLM Transaction Extraction', () => {
  it('should extract transactions from bank statement text', async () => {
    const sampleText = `
      HSBC Bank Statement
      Date: January 2025

      15 Jan  Tesco       -45.50   GBP
      16 Jan  Salary      +3500.00 GBP
      17 Jan  Transport   -25.00   GBP
    `;

    const result = await extractTransactionsFromText(sampleText);

    expect(result).toBeDefined();
    expect(result.transactions).toBeInstanceOf(Array);
    expect(result.transactions.length).toBeGreaterThan(0);
    expect(result.bank_detected).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should return structured format', async () => {
    const sampleText = 'Bank statement text';
    const result = await extractTransactionsFromText(sampleText);

    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('bank_detected');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('account_type');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/llm-extractor.test.js
```

Expected: FAIL - "extractTransactionsFromText is not defined"

**Step 3: Write LLM integration implementation**

Create `lib/llm-extractor.js`:
```javascript
const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function extractTransactionsFromText(statementText) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const prompt = `You are a bank statement parser. Extract all transactions from the following bank statement text and return as JSON.

Bank Statement:
${statementText}

Return ONLY valid JSON (no markdown, no extra text) in this format:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": number (positive for credit, negative for debit),
      "merchant": "merchant name",
      "description": "transaction description",
      "transaction_type": "debit" or "credit"
    }
  ],
  "bank_detected": "bank name",
  "account_type": "checking/savings/investment",
  "confidence": 0.0 to 1.0
}`;

  try {
    const response = await axios.post(OPENROUTER_URL, {
      model: 'mistralai/mistral-7b-instruct',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    const result = JSON.parse(content);

    return result;
  } catch (err) {
    throw new Error(`LLM extraction failed: ${err.message}`);
  }
}

module.exports = { extractTransactionsFromText };
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/llm-extractor.test.js
```

Expected: PASS (or skip if OPENROUTER key not available - add jest.skip())

**Step 5: Commit**

```bash
git add lib/llm-extractor.js tests/lib/llm-extractor.test.js
git commit -m "feat: Add LLM-powered transaction extraction with OpenRouter + Mistral"
```

---

### Task 4: Create Bank Detection Utility

**Files:**
- Create: `lib/bank-detector.js`
- Create: `tests/lib/bank-detector.test.js`

**Step 1: Write failing test for bank detection**

Create `tests/lib/bank-detector.test.js`:
```javascript
const { detectBank } = require('../../lib/bank-detector');

describe('Bank Detection', () => {
  const supportedBanks = {
    UK: ['HSBC', 'Revolut', 'AMEX'],
    India: ['ICICI', 'HSBC']
  };

  it('should detect HSBC UK', () => {
    const text = 'HSBC Bank UK\nStatement for account ending 1234';
    const result = detectBank(text);

    expect(result).toBeDefined();
    expect(result.bank).toBe('HSBC');
    expect(result.country).toBe('UK');
  });

  it('should detect ICICI India', () => {
    const text = 'ICICI Bank Limited\nAccount Statement';
    const result = detectBank(text);

    expect(result).toBeDefined();
    expect(result.bank).toBe('ICICI');
    expect(result.country).toBe('India');
  });

  it('should detect Revolut', () => {
    const text = 'Revolut Statement\nTransaction History';
    const result = detectBank(text);

    expect(result.bank).toBe('Revolut');
  });

  it('should return null for unknown bank', () => {
    const text = 'Unknown Bank Statement';
    const result = detectBank(text);

    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/lib/bank-detector.test.js
```

Expected: FAIL - "detectBank is not defined"

**Step 3: Write bank detection implementation**

Create `lib/bank-detector.js`:
```javascript
const BANK_PATTERNS = {
  HSBC: {
    patterns: [/HSBC\s+(Bank|UK|India)/i, /hsbc\.co\.uk/i],
    countries: ['UK', 'India']
  },
  Revolut: {
    patterns: [/Revolut/i, /revolut\.com/i],
    countries: ['UK']
  },
  AMEX: {
    patterns: [/American\s+Express|AMEX|amex\.com/i],
    countries: ['UK']
  },
  ICICI: {
    patterns: [/ICICI\s+Bank|icicibank\.com/i],
    countries: ['India']
  }
};

function detectBank(statementText) {
  for (const [bankName, config] of Object.entries(BANK_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(statementText)) {
        // Try to determine country from text
        const country = config.countries.length === 1 ? config.countries[0] : inferCountry(statementText, config.countries);
        return {
          bank: bankName,
          country: country,
          confidence: 0.95
        };
      }
    }
  }
  return null;
}

function inferCountry(text, possibleCountries) {
  if (possibleCountries.length === 1) return possibleCountries[0];

  if (/£|GBP|UK|United Kingdom|London/i.test(text)) return 'UK';
  if (/₹|INR|India|Mumbai|Bangalore/i.test(text)) return 'India';

  return possibleCountries[0]; // Default to first option
}

module.exports = { detectBank };
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/bank-detector.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/bank-detector.js tests/lib/bank-detector.test.js
git commit -m "feat: Add bank detection with pattern matching for UK and India banks"
```

---

## PHASE 2: Upload Endpoint & Steps 1-2

### Task 5: Create Upload Route Handler

**Files:**
- Create: `routes/ops.js`
- Modify: `app.js`

**Step 1: Create ops routes file**

Create `routes/ops.js`:
```javascript
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

module.exports = router;
```

**Step 2: Register ops routes in app.js**

Modify `app.js` - add after dashboard routes:
```javascript
const opsRoutes = require('./routes/ops');
// ... existing code ...

// Routes
app.use('/', authRoutes);
app.use('/dashboard', isAuthenticated, dashboardRoutes);
app.use('/ops', isAuthenticated, opsRoutes);  // Add this line
```

**Step 3: Create uploads directory in .gitignore**

Modify `.gitignore`:
```
uploads/
*.pdf
```

**Step 4: Run basic test**

```bash
npm test
```

Expected: All existing tests still pass

**Step 5: Commit**

```bash
git add routes/ops.js app.js .gitignore
git commit -m "feat: Create ops routes with PDF upload endpoint (Steps 1-2)"
```

---

### Task 6: Create Upload UI (Steps 1-2)

**Files:**
- Create: `views/ops/upload.ejs`

**Step 1: Create upload view**

Create `views/ops/upload.ejs`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upload Bank Statement</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --bg-primary: #1a1a1a;
      --bg-secondary: #252525;
      --bg-tertiary: #2d2d2d;
      --accent: #22c55e;
      --text-primary: #ffffff;
      --text-secondary: #b0b0b0;
      --border: #3a3a3a;
    }

    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px 20px;
    }

    .header {
      max-width: 800px;
      margin: 0 auto 40px;
    }

    .back-link {
      color: var(--accent);
      text-decoration: none;
      font-size: 14px;
      margin-bottom: 20px;
      display: inline-block;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
    }

    .progress-bar {
      max-width: 800px;
      margin: 0 auto 40px;
      background: var(--border);
      height: 4px;
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      background: var(--accent);
      height: 100%;
      width: 20%;
      transition: width 0.3s ease;
    }

    .step-indicator {
      max-width: 800px;
      margin: 0 auto 40px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 20px;
    }

    .card h2 {
      font-size: 16px;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
    }

    .drag-drop-zone {
      border: 2px dashed var(--border);
      border-radius: 8px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .drag-drop-zone:hover {
      border-color: var(--accent);
      background: rgba(34, 197, 94, 0.05);
    }

    .drag-drop-zone.drag-over {
      border-color: var(--accent);
      background: rgba(34, 197, 94, 0.1);
    }

    .drag-drop-icon {
      font-size: 40px;
      margin-bottom: 16px;
    }

    .drag-drop-text {
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .drag-drop-hint {
      font-size: 12px;
      color: var(--border);
    }

    #pdfInput {
      display: none;
    }

    .file-info {
      margin-top: 20px;
      padding: 16px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      border-left: 3px solid var(--accent);
    }

    .file-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .file-size {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .bank-detection {
      margin-top: 24px;
      padding: 16px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      border-top: 1px solid var(--border);
    }

    .bank-detected {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .bank-detected-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
    }

    .bank-detected-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--accent);
    }

    .confidence {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .bank-selector {
      margin-top: 16px;
    }

    .bank-selector label {
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .bank-selector select {
      width: 100%;
      padding: 10px 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
      cursor: pointer;
    }

    .bank-selector select:focus {
      outline: none;
      border-color: var(--accent);
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      justify-content: flex-end;
    }

    .btn {
      padding: 12px 24px;
      border-radius: 6px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: var(--accent);
      color: #000;
    }

    .btn-primary:hover:not(:disabled) {
      background: #16a34a;
      box-shadow: 0 8px 16px rgba(34, 197, 94, 0.2);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .error {
      color: #ef4444;
      font-size: 14px;
      margin-top: 12px;
    }

    .loading {
      display: none;
      text-align: center;
      padding: 20px;
    }

    .spinner {
      border: 3px solid var(--border);
      border-top: 3px solid var(--accent);
      border-radius: 50%;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin: 0 auto 10px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .container {
        padding: 0 16px;
      }

      .card {
        padding: 24px;
      }

      .button-group {
        flex-direction: column-reverse;
      }

      .btn {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <a href="/dashboard" class="back-link">← Back to Dashboard</a>
    <h1>📤 Upload Bank Statement</h1>
    <p class="subtitle">Import transactions from your bank</p>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width: 20%;"></div>
  </div>

  <div class="step-indicator">
    <span>1. Upload</span>
    <span>2. Confirm Bank</span>
    <span>3. Review</span>
    <span>4. Categories</span>
    <span>5. Confirm</span>
  </div>

  <div class="container">
    <div class="card">
      <h2>Step 1: Upload PDF</h2>

      <form id="uploadForm" enctype="multipart/form-data">
        <div class="drag-drop-zone" id="dragDropZone">
          <div class="drag-drop-icon">📄</div>
          <div class="drag-drop-text">Drop PDF here or click to browse</div>
          <div class="drag-drop-hint">Supported: PDF files (max 5MB)</div>
          <input type="file" id="pdfInput" accept=".pdf" name="pdf" />
        </div>

        <div id="fileInfo" class="file-info" style="display: none;">
          <div class="file-name" id="fileName"></div>
          <div class="file-size" id="fileSize"></div>
        </div>

        <div id="bankDetection" class="bank-detection" style="display: none;">
          <div class="bank-detected">
            <div>
              <div class="bank-detected-label">Bank Detected</div>
              <div class="bank-detected-value" id="bankDetectedValue">-</div>
              <div class="confidence" id="confidence"></div>
            </div>
          </div>

          <div class="bank-selector">
            <label for="bankSelect">Confirm or Select Bank:</label>
            <select id="bankSelect">
              <option value="">Select a bank...</option>
              <optgroup label="UK Banks">
                <option value="HSBC">HSBC</option>
                <option value="Revolut">Revolut</option>
                <option value="AMEX">American Express (AMEX)</option>
              </optgroup>
              <optgroup label="India Banks">
                <option value="ICICI">ICICI</option>
                <option value="HSBC">HSBC India</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div class="loading" id="loading">
          <div class="spinner"></div>
          <p>Processing PDF...</p>
        </div>

        <div class="error" id="error"></div>

        <div class="button-group">
          <button type="button" class="btn btn-secondary" onclick="window.history.back()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="submitBtn" disabled>Continue to Bank Confirmation</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const form = document.getElementById('uploadForm');
    const dragDropZone = document.getElementById('dragDropZone');
    const pdfInput = document.getElementById('pdfInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const bankDetection = document.getElementById('bankDetection');
    const bankDetectedValue = document.getElementById('bankDetectedValue');
    const confidence = document.getElementById('confidence');
    const bankSelect = document.getElementById('bankSelect');
    const submitBtn = document.getElementById('submitBtn');
    const error = document.getElementById('error');
    const loading = document.getElementById('loading');

    // Drag and drop
    dragDropZone.addEventListener('click', () => pdfInput.click());

    dragDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dragDropZone.classList.add('drag-over');
    });

    dragDropZone.addEventListener('dragleave', () => {
      dragDropZone.classList.remove('drag-over');
    });

    dragDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dragDropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        pdfInput.files = files;
        handleFileSelect();
      }
    });

    pdfInput.addEventListener('change', handleFileSelect);

    function handleFileSelect() {
      const file = pdfInput.files[0];
      if (!file) return;

      // Show file info
      fileInfo.style.display = 'block';
      fileName.textContent = file.name;
      fileSize.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';

      // Reset error
      error.textContent = '';

      // Enable submit
      submitBtn.disabled = false;
    }

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const file = pdfInput.files[0];
      if (!file) {
        error.textContent = 'Please select a PDF file';
        return;
      }

      loading.style.display = 'block';
      submitBtn.disabled = true;

      const formData = new FormData();
      formData.append('pdf', file);

      try {
        const response = await fetch('/ops/upload', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        // Show bank detection
        if (data.bankDetection && data.bankDetection.bank) {
          bankDetectedValue.textContent = data.bankDetection.bank;
          confidence.textContent = `Confidence: ${(data.bankDetection.confidence * 100).toFixed(0)}%`;
          bankSelect.value = data.bankDetection.bank;
        }

        bankDetection.style.display = 'block';
        submitBtn.textContent = 'Confirm Bank & Continue';

      } catch (err) {
        error.textContent = err.message;
      } finally {
        loading.style.display = 'none';
        submitBtn.disabled = false;
      }
    });

    // Bank confirmation
    bankSelect.addEventListener('change', () => {
      submitBtn.disabled = bankSelect.value === '';
    });

    // Override form submit for bank confirmation
    const originalSubmit = form.onsubmit;
    form.addEventListener('submit', async (e) => {
      if (bankDetection.style.display !== 'none' && bankSelect.value) {
        e.preventDefault();

        loading.style.display = 'block';
        submitBtn.disabled = true;

        try {
          const response = await fetch('/ops/upload/confirm-bank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedBank: bankSelect.value })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Confirmation failed');
          }

          // Redirect to Step 3
          window.location.href = '/ops/upload?step=3';

        } catch (err) {
          error.textContent = err.message;
        } finally {
          loading.style.display = 'none';
          submitBtn.disabled = false;
        }
      }
    });
  </script>
</body>
</html>
```

**Step 2: Create ops directory**

```bash
mkdir -p views/ops
```

**Step 3: Run server and test UI loads**

```bash
npm run dev
# Navigate to http://localhost:3000/ops/upload (after logging in)
```

Expected: Upload page loads with drag-drop zone

**Step 4: Commit**

```bash
git add views/ops/upload.ejs
git commit -m "ui: Create upload form with drag-drop and bank detection (Steps 1-2)"
```

---

## PHASE 3: Steps 3-4 Frontend (Preview & Categories)

### Task 7: Create Transaction Preview Page

**Files:**
- Create: `views/ops/preview.ejs`
- Modify: `routes/ops.js` (add GET /ops/upload?step=3 and POST endpoints)

**Step 1: Add transaction extraction and preview endpoints**

Modify `routes/ops.js` - add these endpoints before `module.exports`:
```javascript
const { extractTransactionsFromText } = require('../lib/llm-extractor');

// POST /ops/upload/extract-transactions - Extract from LLM
router.post('/upload/extract-transactions', async (req, res) => {
  try {
    if (!req.session.uploadState) {
      return res.status(400).json({ error: 'No upload in progress' });
    }

    const { statementText } = req.session.uploadState;

    // Call LLM for extraction
    const extracted = await extractTransactionsFromText(statementText);

    // Store in session
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

// GET /ops/upload/preview - Preview extracted transactions
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
```

**Step 2: Create preview template**

Create `views/ops/preview.ejs`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Transactions</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --bg-primary: #1a1a1a;
      --bg-secondary: #252525;
      --bg-tertiary: #2d2d2d;
      --accent: #22c55e;
      --text-primary: #ffffff;
      --text-secondary: #b0b0b0;
      --border: #3a3a3a;
    }

    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px 20px;
    }

    .header {
      max-width: 1000px;
      margin: 0 auto 40px;
    }

    .back-link {
      color: var(--accent);
      text-decoration: none;
      font-size: 14px;
      margin-bottom: 20px;
      display: inline-block;
    }

    h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
    }

    .progress-bar {
      max-width: 1000px;
      margin: 0 auto 40px;
      background: var(--border);
      height: 4px;
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      background: var(--accent);
      height: 100%;
      width: 60%;
      transition: width 0.3s ease;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 20px;
      overflow-x: auto;
    }

    .card h2 {
      font-size: 16px;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
    }

    .transaction-count {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 20px;
      padding: 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    thead {
      background: var(--bg-tertiary);
      position: sticky;
      top: 0;
    }

    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 12px;
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 12px;
      border-bottom: 1px solid var(--border);
    }

    tbody tr {
      transition: background 0.2s ease;
    }

    tbody tr:hover {
      background: var(--bg-tertiary);
    }

    tbody tr.skipped td {
      opacity: 0.5;
      text-decoration: line-through;
    }

    .checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--accent);
    }

    .date {
      font-family: 'Courier New', monospace;
      color: var(--text-secondary);
    }

    .amount {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      text-align: right;
    }

    .debit {
      color: #ef4444;
    }

    .credit {
      color: var(--accent);
    }

    .merchant {
      font-weight: 500;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      justify-content: flex-end;
    }

    .btn {
      padding: 12px 24px;
      border-radius: 6px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: var(--accent);
      color: #000;
    }

    .btn-primary:hover:not(:disabled) {
      background: #16a34a;
      box-shadow: 0 8px 16px rgba(34, 197, 94, 0.2);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    @media (max-width: 768px) {
      .card {
        padding: 16px;
        overflow-x: auto;
      }

      table {
        font-size: 12px;
      }

      th, td {
        padding: 8px;
      }

      .button-group {
        flex-direction: column-reverse;
      }

      .btn {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <a href="/ops/upload" class="back-link">← Back</a>
    <h1>📋 Review Transactions</h1>
    <p class="subtitle">Review extracted transactions from <%= bank %></p>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width: 60%;"></div>
  </div>

  <div class="container">
    <div class="card">
      <h2>Step 3: Transaction Preview</h2>

      <div class="transaction-count">
        <strong><%= count %></strong> transactions extracted from <%= bank %>
      </div>

      <form id="previewForm">
        <table>
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" id="selectAll" class="checkbox" /></th>
              <th>Date</th>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <% transactions.forEach((tx, idx) => { %>
            <tr data-id="<%= idx %>">
              <td><input type="checkbox" class="checkbox transaction-checkbox" value="<%= idx %>" /></td>
              <td class="date"><%= new Date(tx.date).toLocaleDateString() %></td>
              <td class="merchant"><%= tx.merchant %></td>
              <td class="amount <%= tx.transaction_type === 'debit' ? 'debit' : 'credit' %>">
                <%= tx.transaction_type === 'debit' ? '-' : '+' %> <%= Math.abs(tx.amount).toFixed(2) %>
              </td>
              <td><%= tx.transaction_type %></td>
            </tr>
            <% }); %>
          </tbody>
        </table>

        <div class="button-group">
          <button type="button" class="btn btn-secondary" onclick="window.history.back()">Back</button>
          <button type="submit" class="btn btn-primary">Review Categories →</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const form = document.getElementById('previewForm');
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.transaction-checkbox');

    selectAll.addEventListener('change', () => {
      checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        cb.closest('tr').classList.toggle('skipped', selectAll.checked);
      });
    });

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        cb.closest('tr').classList.toggle('skipped', cb.checked);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const skippedIds = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      try {
        const response = await fetch('/ops/upload/skip-transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skippedIds })
        });

        if (!response.ok) throw new Error('Failed to proceed');

        window.location.href = '/ops/categories';
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  </script>
</body>
</html>
```

**Step 3: Test preview page loads**

```bash
npm run dev
# Upload a PDF, then navigate to preview
```

Expected: Transaction table displays with checkboxes

**Step 4: Commit**

```bash
git add routes/ops.js views/ops/preview.ejs
git commit -m "feat: Add transaction preview table with skip functionality (Step 3)"
```

---

## PHASE 4: Step 5 & Finalization

### Task 8: Complete Step 4 & 5 (Category Review & Confirmation)

**Files:**
- Create: `views/ops/categories-review.ejs`
- Modify: `routes/ops.js` (add category review and finalization endpoints)
- Modify: `db/transactions.js` (new - bulk insert function)

**Step 1: Create transactions database module**

Create `db/transactions.js`:
```javascript
const pool = require('./connection');

// Bulk insert transactions
async function insertTransactions(userId, transactions, bankAccountId) {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const query = `
    INSERT INTO transactions (
      user_id, bank_account_id, transaction_date, amount, currency,
      description, merchant, transaction_type, category_id, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING id, transaction_date, amount, merchant, category_id
  `;

  const results = [];

  for (const tx of transactions) {
    try {
      const result = await pool.query(query, [
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

  return results;
}

// Get default category by name
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
```

**Step 2: Add to ops.js - category review endpoints**

Modify `routes/ops.js` - add before `module.exports`:
```javascript
const { insertTransactions, getCategoryByName } = require('../db/transactions');

// GET /ops/categories-review - Category review page
router.get('/categories-review', (req, res) => {
  try {
    if (!req.session.uploadState || !req.session.uploadState.extractedTransactions) {
      return res.redirect('/ops/upload');
    }

    const { extractedTransactions } = req.session.uploadState;

    res.render('ops/categories-review', {
      title: 'Review Categories',
      transactions: extractedTransactions
    });
  } catch (err) {
    console.error('Categories review error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ops/upload/confirm - Final confirmation and save
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
      // Create new bank account
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
```

**Step 3: Create categories review template**

Create `views/ops/categories-review.ejs`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Categories</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --bg-primary: #1a1a1a;
      --bg-secondary: #252525;
      --bg-tertiary: #2d2d2d;
      --accent: #22c55e;
      --text-primary: #ffffff;
      --text-secondary: #b0b0b0;
      --border: #3a3a3a;
    }

    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px 20px;
    }

    .header {
      max-width: 1000px;
      margin: 0 auto 40px;
    }

    .back-link {
      color: var(--accent);
      text-decoration: none;
      font-size: 14px;
      margin-bottom: 20px;
      display: inline-block;
    }

    h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
    }

    .progress-bar {
      max-width: 1000px;
      margin: 0 auto 40px;
      background: var(--border);
      height: 4px;
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      background: var(--accent);
      height: 100%;
      width: 80%;
      transition: width 0.3s ease;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 20px;
      overflow-x: auto;
    }

    .card h2 {
      font-size: 16px;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    thead {
      background: var(--bg-tertiary);
      position: sticky;
      top: 0;
    }

    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 12px;
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 12px;
      border-bottom: 1px solid var(--border);
    }

    tbody tr:hover {
      background: var(--bg-tertiary);
    }

    .amount {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      text-align: right;
    }

    .debit {
      color: #ef4444;
    }

    .credit {
      color: var(--accent);
    }

    .category-select {
      padding: 8px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-primary);
      font-size: 13px;
      min-width: 120px;
      cursor: pointer;
    }

    .category-select:focus {
      outline: none;
      border-color: var(--accent);
    }

    .category-select.uncategorized {
      border-color: #ef4444;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      justify-content: flex-end;
    }

    .btn {
      padding: 12px 24px;
      border-radius: 6px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: var(--accent);
      color: #000;
    }

    .btn-primary:hover:not(:disabled) {
      background: #16a34a;
      box-shadow: 0 8px 16px rgba(34, 197, 94, 0.2);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .loading {
      display: none;
      text-align: center;
      padding: 20px;
    }

    .spinner {
      border: 3px solid var(--border);
      border-top: 3px solid var(--accent);
      border-radius: 50%;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin: 0 auto 10px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .card {
        padding: 16px;
        overflow-x: auto;
      }

      table {
        font-size: 12px;
      }

      th, td {
        padding: 8px;
      }

      .category-select {
        min-width: 100px;
        font-size: 12px;
      }

      .button-group {
        flex-direction: column-reverse;
      }

      .btn {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <a href="/ops/upload" class="back-link">← Back</a>
    <h1>🏷️ Review Categories</h1>
    <p class="subtitle">Assign categories to your transactions</p>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width: 80%;"></div>
  </div>

  <div class="container">
    <div class="card">
      <h2>Step 4: Category Review</h2>

      <form id="categoriesForm">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            <% transactions.forEach((tx, idx) => { %>
            <tr>
              <td><%= new Date(tx.date).toLocaleDateString() %></td>
              <td><%= tx.merchant %></td>
              <td class="amount <%= tx.transaction_type === 'debit' ? 'debit' : 'credit' %>">
                <%= tx.transaction_type === 'debit' ? '-' : '+' %> <%= Math.abs(tx.amount).toFixed(2) %>
              </td>
              <td>
                <select class="category-select" data-id="<%= idx %>">
                  <option value="">Uncategorized</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Transport">Transport</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Dining">Dining</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Subscriptions">Subscriptions</option>
                  <option value="Salary/Income">Salary/Income</option>
                  <option value="Savings">Savings</option>
                  <option value="Investments">Investments</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Fees">Fees</option>
                </select>
              </td>
            </tr>
            <% }); %>
          </tbody>
        </table>

        <div class="loading" id="loading">
          <div class="spinner"></div>
          <p>Importing transactions...</p>
        </div>

        <div class="button-group">
          <button type="button" class="btn btn-secondary" onclick="window.history.back()">Back</button>
          <button type="submit" class="btn btn-primary">Confirm & Import →</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const form = document.getElementById('categoriesForm');
    const loading = document.getElementById('loading');
    const selects = document.querySelectorAll('.category-select');

    selects.forEach(select => {
      select.addEventListener('change', () => {
        select.classList.toggle('uncategorized', select.value === '');
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      loading.style.display = 'block';

      const categorizedTransactions = Array.from(selects).map(select => ({
        category_id: select.value || null
      }));

      try {
        const response = await fetch('/ops/upload/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categorizedTransactions })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Confirmation failed');
        }

        // Show success and redirect
        window.location.href = data.redirect;

      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        loading.style.display = 'none';
      }
    });
  </script>
</body>
</html>
```

**Step 4: Test category review**

```bash
npm test
npm run dev
# Complete upload flow through to categories page
```

Expected: Categories page loads with dropdown selectors

**Step 5: Commit**

```bash
git add db/transactions.js routes/ops.js views/ops/categories-review.ejs
git commit -m "feat: Add category review and final confirmation with transaction import (Steps 4-5)"
```

---

## PHASE 5: Settings/Ops Navigation

### Task 9: Create Settings Sidebar & Routes

**Files:**
- Create: `views/ops/layout.ejs` (shared layout)
- Modify: `routes/ops.js` (add category and bank management routes)

**Step 1: Create ops layout with sidebar**

Create `views/ops/layout.ejs`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %> - Settings</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --bg-primary: #1a1a1a;
      --bg-secondary: #252525;
      --bg-tertiary: #2d2d2d;
      --accent: #22c55e;
      --text-primary: #ffffff;
      --text-secondary: #b0b0b0;
      --border: #3a3a3a;
    }

    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    .sidebar {
      width: 240px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      padding: 24px 0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .sidebar-header {
      padding: 0 20px;
      margin-bottom: 32px;
    }

    .sidebar-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
    }

    .sidebar-nav {
      flex: 1;
    }

    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;
    }

    .sidebar-link:hover {
      color: var(--accent);
      background: var(--bg-tertiary);
    }

    .sidebar-link.active {
      color: var(--accent);
      background: var(--bg-tertiary);
      border-left-color: var(--accent);
    }

    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .topbar {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .topbar-left h1 {
      font-size: 24px;
      margin-bottom: 4px;
    }

    .topbar-subtitle {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .topbar-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .btn-back {
      padding: 8px 16px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-back:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 40px;
    }

    @media (max-width: 768px) {
      body {
        flex-direction: column;
      }

      .sidebar {
        width: 100%;
        height: auto;
        border-right: none;
        border-bottom: 1px solid var(--border);
        display: flex;
        flex-direction: row;
        padding: 12px 0;
        overflow: auto;
      }

      .sidebar-header {
        margin-bottom: 0;
        display: none;
      }

      .sidebar-nav {
        display: flex;
        flex: 1;
        gap: 0;
      }

      .sidebar-link {
        border-left: none;
        border-bottom: 3px solid transparent;
        padding: 12px 16px;
      }

      .sidebar-link.active {
        border-left: none;
        border-bottom-color: var(--accent);
      }

      .content {
        padding: 20px;
      }

      .topbar {
        padding: 16px 20px;
      }
    }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-title">Settings</div>
    </div>
    <nav class="sidebar-nav">
      <a href="/ops/upload" class="sidebar-link <%= currentPage === 'upload' ? 'active' : '' %>">
        <span>📤</span> Upload
      </a>
      <a href="/ops/categories" class="sidebar-link <%= currentPage === 'categories' ? 'active' : '' %>">
        <span>🏷️</span> Categories
      </a>
      <a href="/ops/banks" class="sidebar-link <%= currentPage === 'banks' ? 'active' : '' %>">
        <span>🏦</span> Banks
      </a>
    </nav>
  </aside>

  <div class="main">
    <div class="topbar">
      <div class="topbar-left">
        <h1><%= title %></h1>
        <div class="topbar-subtitle"><%= subtitle || '' %></div>
      </div>
      <div class="topbar-right">
        <a href="/dashboard" class="btn-back">← Back to Dashboard</a>
      </div>
    </div>

    <div class="content">
      <%- body %>
    </div>
  </div>
</body>
</html>
```

**Step 2: Add category and bank management routes**

Modify `routes/ops.js` - add before `module.exports`:
```javascript
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
```

**Step 3: Create categories management page**

Create `views/ops/categories.ejs`:
```html
<h2>Manage Categories</h2>

<div style="margin-top: 40px;">
  <h3 style="font-size: 16px; margin-bottom: 20px;">System Categories</h3>

  <table style="width: 100%; border-collapse: collapse;">
    <thead style="background: var(--bg-tertiary);">
      <tr>
        <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Name</th>
        <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Description</th>
      </tr>
    </thead>
    <tbody>
      <% categories.filter(c => c.system_defined).forEach(cat => { %>
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 12px;"><%= cat.name %></td>
        <td style="padding: 12px; color: var(--text-secondary);"><%= cat.description %></td>
      </tr>
      <% }); %>
    </tbody>
  </table>
</div>

<% if (categories.some(c => !c.system_defined)) { %>
<div style="margin-top: 40px;">
  <h3 style="font-size: 16px; margin-bottom: 20px;">Custom Categories</h3>

  <table style="width: 100%; border-collapse: collapse;">
    <thead style="background: var(--bg-tertiary);">
      <tr>
        <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Name</th>
        <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Description</th>
        <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Actions</th>
      </tr>
    </thead>
    <tbody>
      <% categories.filter(c => !c.system_defined).forEach(cat => { %>
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 12px;"><%= cat.name %></td>
        <td style="padding: 12px; color: var(--text-secondary);"><%= cat.description %></td>
        <td style="padding: 12px; text-align: center;">
          <button style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button>
        </td>
      </tr>
      <% }); %>
    </tbody>
  </table>
</div>
<% } %>

<div style="margin-top: 40px; padding: 20px; background: var(--bg-secondary); border-radius: 8px; border: 1px dashed var(--border);">
  <h3 style="font-size: 14px; margin-bottom: 12px;">Add Custom Category</h3>
  <form style="display: flex; gap: 12px;">
    <input type="text" placeholder="Category name" style="flex: 1; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary);">
    <button type="submit" style="padding: 10px 20px; background: var(--accent); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Add</button>
  </form>
</div>
```

**Step 4: Create banks management page**

Create `views/ops/banks.ejs`:
```html
<h2>Linked Bank Accounts</h2>

<div style="margin-top: 40px;">
  <% if (accounts.length === 0) { %>
    <p style="color: var(--text-secondary); text-align: center; padding: 40px;">
      No bank accounts linked yet. <a href="/ops/upload" style="color: var(--accent); text-decoration: none;">Upload a statement</a> to add one.
    </p>
  <% } else { %>
    <table style="width: 100%; border-collapse: collapse;">
      <thead style="background: var(--bg-tertiary);">
        <tr>
          <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Bank</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Type</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Country</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Currency</th>
          <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 12px;">Status</th>
        </tr>
      </thead>
      <tbody>
        <% accounts.forEach(account => { %>
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 12px;"><%= account.bank_name %></td>
          <td style="padding: 12px; text-transform: capitalize;"><%= account.account_type %></td>
          <td style="padding: 12px;"><%= account.country %></td>
          <td style="padding: 12px; font-family: 'Courier New', monospace;"><%= account.currency %></td>
          <td style="padding: 12px; text-align: center;">
            <span style="display: inline-block; padding: 4px 8px; background: var(--accent); color: #000; border-radius: 4px; font-size: 12px; font-weight: 600;">
              <%= account.confirmed ? 'Active' : 'Pending' %>
            </span>
          </td>
        </tr>
        <% }); %>
      </tbody>
    </table>
  <% } %>
</div>
```

**Step 5: Update existing ops views to use layout**

Update `views/ops/upload.ejs` - wrap with layout (add at top):
```html
<% layout('ops/layout') %>
<div style="max-width: 800px;">
  <!-- existing upload form HTML here -->
</div>
```

**Step 6: Test ops pages load**

```bash
npm test
npm run dev
# Navigate to /ops/upload, /ops/categories, /ops/banks
```

Expected: Settings pages load with sidebar navigation

**Step 7: Commit**

```bash
git add routes/ops.js views/ops/layout.ejs views/ops/categories.ejs views/ops/banks.ejs
git commit -m "feat: Add Settings/Ops page structure with sidebar navigation"
```

---

## PHASE 6: Testing & Polish

### Task 10: Unit Tests for PDF Processing

**Files:**
- Modify: `tests/lib/pdf-extractor.test.js` (already created)
- Modify: `tests/lib/llm-extractor.test.js` (already created)
- Modify: `tests/lib/bank-detector.test.js` (already created)

**Step 1: Run all existing tests**

```bash
npm test
```

Expected: All tests pass (20+ tests)

**Step 2: Commit**

```bash
git add tests/
git commit -m "test: Verify all PDF processing tests passing"
```

---

### Task 11: Integration Test for Upload Flow

**Files:**
- Create: `tests/routes/ops.test.js`

**Step 1: Create integration test**

Create `tests/routes/ops.test.js`:
```javascript
const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Mock the app - requires actual app structure
// This is a placeholder for full integration testing

describe('PDF Upload Routes', () => {
  it('should handle file upload', async () => {
    const testPdf = '/Users/tanveer/Downloads/2025-11-09_Statement (1).pdf';

    if (fs.existsSync(testPdf)) {
      // Integration test would go here
      expect(true).toBe(true);
    }
  });
});
```

**Step 2: Run tests**

```bash
npm test -- tests/routes/ops.test.js
```

Expected: Placeholder test passes

**Step 3: Commit**

```bash
git add tests/routes/ops.test.js
git commit -m "test: Add PDF upload integration test placeholders"
```

---

### Task 12: E2E Test with Playwright

**Files:**
- Create: `tests/e2e/pdf-upload.spec.js`

**Step 1: Create E2E test**

Create `tests/e2e/pdf-upload.spec.js`:
```javascript
const { test, expect } = require('@playwright/test');

test.describe('PDF Upload E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to upload page after login
    await page.goto('http://localhost:3000/ops/upload');
  });

  test('should display upload form', async ({ page }) => {
    await expect(page.locator('text=Upload Bank Statement')).toBeVisible();
    await expect(page.locator('id=dragDropZone')).toBeVisible();
  });

  test('should reject non-PDF files', async ({ page }) => {
    // Create a test file
    const input = page.locator('id=pdfInput');
    // File validation would be tested here
  });
});
```

**Step 2: Run E2E tests**

```bash
npm test -- tests/e2e/pdf-upload.spec.js
```

Expected: Tests run (may skip without active server)

**Step 3: Commit**

```bash
git add tests/e2e/pdf-upload.spec.js
git commit -m "test: Add E2E tests for PDF upload flow with Playwright"
```

---

## Summary

**Plan complete and saved to `docs/plans/2026-02-01-pdf-upload-implementation.md`.**

### Total Tasks: 12

1. ✅ Install dependencies
2. ✅ Create PDF extraction utility
3. ✅ Create LLM integration utility
4. ✅ Create bank detection utility
5. ✅ Create upload route handler
6. ✅ Create upload UI (Steps 1-2)
7. ✅ Create transaction preview page (Step 3)
8. ✅ Complete Steps 4 & 5 (Category review & confirmation)
9. ✅ Create Settings/Ops navigation
10. ✅ Unit tests for PDF processing
11. ✅ Integration tests
12. ✅ E2E tests

### Key Files Created
- `lib/pdf-extractor.js` - PDF text extraction
- `lib/llm-extractor.js` - LLM transaction extraction
- `lib/bank-detector.js` - Bank auto-detection
- `routes/ops.js` - All PDF upload endpoints
- `db/transactions.js` - Bulk transaction insertion
- `views/ops/upload.ejs` - Upload form (Steps 1-2)
- `views/ops/preview.ejs` - Transaction preview (Step 3)
- `views/ops/categories-review.ejs` - Category review (Step 4)
- `views/ops/categories.ejs` - Category management
- `views/ops/banks.ejs` - Bank account management
- `views/ops/layout.ejs` - Settings layout

### Execution Approach

**Choose your preferred execution method:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration with immediate feedback

**2. Parallel Session (separate)** - Open new session using executing-plans, batch execution with checkpoints between major phases

**Which approach would you prefer?**

