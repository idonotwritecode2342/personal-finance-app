# PDF Upload & Transaction Extraction Feature Design

**Date:** 2026-02-01
**Version:** MVP 1.0 Phase 2
**Branch:** feature/pdf-upload
**Test File:** `/Users/tanveer/Downloads/2025-11-09_Statement (1).pdf`

---

## Overview

Multi-step PDF statement upload feature with LLM-powered transaction extraction, bank auto-detection, and interactive transaction review workflow.

---

## Route Structure

```
/ops/upload      - PDF upload & extraction workflow (5-step process)
/ops/categories  - Category management (view, edit, add custom)
/ops/banks       - Bank account management (view, edit, add)
```

**Navigation:**
- Settings button in dashboard header (gear icon ⚙️)
- Opens sidebar with three options

---

## Supported Banks

**UK:**
- HSBC
- Revolut
- American Express (AMEX)

**India:**
- ICICI
- HSBC

---

## 5-Step Upload Workflow

### Step 1: File Upload
- Drag-and-drop zone or file picker
- Accept .pdf files only
- Validate file size (< 5MB)
- Display file name and size
- Error handling for invalid files
- Submit button to proceed

### Step 2: Bank Confirmation
- Display auto-detected bank name with confidence level
- Dropdown to manually select bank if detection fails
- Account type hint based on statement format
- Cannot proceed without bank confirmation
- Proceed button

### Step 3: Transaction Preview
- Table layout: Date | Merchant | Amount | LLM-Suggested Category
- Transaction count displayed at top
- Sortable columns (by date, amount)
- Pagination if 50+ transactions
- Checkbox per row to skip individual transactions
- Monospace font for amounts and dates
- Review & Proceed button

### Step 4: Category Review
- Highlight any "Uncategorized" or low-confidence categories
- Inline category selector (dropdown per transaction)
- Category distribution chart/summary
- Allow bulk category changes
- Proceed button

### Step 5: Final Confirmation
- Summary display:
  - "Import X transactions from [Bank Name]"
  - Category breakdown (Groceries: 5, Transport: 3, etc.)
- Confirm & Import button (shows loading state)
- Success message with checkmark animation
- Auto-redirect to dashboard after 2 seconds

---

## Database Schema & Data Flow

### Tables Used
- `transactions`: Populated with extracted data
- `bank_accounts`: Linked to extracted transactions
- `pdf_uploads`: Tracks upload history and status
- `transaction_categories`: Used for categorization

### Data Flow
1. User uploads PDF → Stored temporarily
2. LLM extracts transactions → Returns structured JSON
3. Bank auto-detected from statement format
4. User confirms bank → Links to existing or creates new account
5. Transactions shown for preview/review
6. User approves → All transactions saved
7. Redirect to dashboard with success notification

### LLM Integration

**Provider:** OpenRouter + Mistral

**Prompt Structure:**
- Send PDF text content to LLM
- Request structured JSON response:
```json
{
  "transactions": [
    {
      "date": "2025-01-15",
      "amount": 45.50,
      "merchant": "Tesco",
      "description": "Grocery shopping",
      "transaction_type": "debit"
    }
  ],
  "bank_detected": "HSBC",
  "account_type": "checking",
  "confidence": 0.95,
  "extraction_notes": "Clear statement format"
}
```

**Error Handling:**
- Log failed extractions with error details
- Show user-friendly error message
- Provide retry option
- Store failed extraction attempts in database

---

## UI Design & Styling

### Design System
- **Dark Theme**: #1a1a1a (background), #252525 (cards), #2d2d2d (interactive)
- **Accent Color**: #22c55e (buttons, highlights, success states)
- **Text**: #ffffff (primary), #b0b0b0 (secondary)
- **Borders**: #3a3a3a (subtle separators)

### Components

**Step Indicator:**
- Visual progress bar at top (1/5, 2/5, etc.)
- Step titles below progress bar
- Color changes to green (#22c55e) as completed

**File Upload Card:**
- Drag-and-drop zone with dashed border
- Icon + "Drop PDF here or click to browse"
- File preview (name, size)
- Error state: red border + error message

**Tables (Steps 3 & 4):**
- Responsive table layout
- Alternating row colors for readability
- Monospace font (Courier New) for amounts/dates
- Hover highlight on rows
- Sticky table header
- Inline category selector (dropdown)

**Buttons:**
- Primary: #22c55e background with hover glow
- Disabled state during processing
- Loading spinner on confirmation
- Success checkmark animation on completion

**Messages:**
- Error: Red (#ef4444) with icon
- Success: Green (#22c55e) with checkmark
- Info: Gray (#b0b0b0) for guidance

---

## Implementation Phases

### Phase 1: Backend Foundation
- PDF text extraction library (pdf-lib or pdfparse)
- OpenRouter API integration
- LLM prompt design and testing
- Bank detection logic (regex patterns for each bank)
- Database functions for saving transactions

### Phase 2: Upload Endpoint & Steps 1-2
- POST /ops/upload endpoint
- File upload handling (temporary storage)
- Bank detection and confirmation logic
- Return bank detection result to frontend

### Phase 3: Steps 3-4 Frontend & Logic
- Transaction preview table rendering
- Category review interface
- Inline category editing
- Category distribution calculation

### Phase 4: Step 5 & Finalization
- Final confirmation logic
- Batch transaction insertion
- Success messaging and redirect
- Upload history tracking

### Phase 5: Settings/Ops Page Structure
- Settings sidebar/navigation
- Category management page
- Bank account management page
- Upload history view

### Phase 6: Testing & Polish
- Unit tests for LLM extraction and bank detection
- Integration tests for upload flow
- E2E tests with Playwright
- Error scenario testing

---

## Success Criteria

✅ User can upload PDF bank statement
✅ System auto-detects bank with user confirmation
✅ LLM extracts transactions accurately (>90% success rate)
✅ Transactions displayed in table format for review
✅ User can edit categories before final import
✅ All transactions saved to database with correct associations
✅ Redirect to dashboard shows new transactions
✅ Error handling with retry option
✅ Supported banks: HSBC, Revolut, AMEX (UK), ICICI, HSBC (India)
✅ Tests: Unit + integration tests covering main flows
✅ UI follows established design system
✅ Responsive on mobile devices

---

## Next Steps

1. ✅ Design validated
2. Create implementation plan
3. Set up feature development with testing
4. Test with provided sample PDF
5. Launch locally for user testing
