# Comprehensive Testing Checklist
## Transactions List & Dashboard Integration Feature

**Date:** 2026-02-02
**Branch:** feature/transactions-list-dashboard
**Automated Tests Status:** ✅ All 32 tests passing

---

## Pre-Testing Setup

Before starting manual testing:

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Ensure you have test data:**
   - At least 100+ transactions in the database
   - Mix of UK (GBP) and India (INR) transactions
   - Mix of debit and credit transactions
   - Various categories assigned
   - Different date ranges (current month, last month, last year)
   - Multiple bank accounts

3. **Browser Testing:**
   - Primary: Latest Chrome/Safari
   - Secondary: Firefox, Edge
   - Mobile: iOS Safari, Android Chrome

---

## Task 18: Navigation and Menu Testing

### Header Navigation Links

**Test all navigation links from Dashboard:**

- [ ] Click "Dashboard" link → Should stay on Dashboard, link shows active state (green border)
- [ ] Click "Transactions" → Should navigate to `/dashboard/transactions`
- [ ] Click "Analytics" → Should navigate to `/analytics` page
- [ ] Click "Agent" → Should navigate to `/agent` page
- [ ] Click "Investments" → Should navigate to `/investments` page
- [ ] Click "Goals" → Should navigate to `/goals` page
- [ ] Click ⚙️ (Ops icon) → Should navigate to `/ops` page
- [ ] Click "Logout" → Should log out and redirect to login page

**Test all navigation links from Transactions page:**

- [ ] Click "Dashboard" → Should navigate back to Dashboard
- [ ] Click "Transactions" link → Should stay on Transactions, link shows active state (green border)
- [ ] Click "Analytics" → Should navigate to `/analytics` page
- [ ] Click "Agent" → Should navigate to `/agent` page
- [ ] Click "Investments" → Should navigate to `/investments` page
- [ ] Click "Goals" → Should navigate to `/goals` page
- [ ] Click ⚙️ (Ops icon) → Should navigate to `/ops` page
- [ ] Click "Logout" → Should log out and redirect to login page

### Active State Highlighting

- [ ] Dashboard page: "Dashboard" link has green border and accent color
- [ ] Transactions page: "Transactions" link has green border and accent color
- [ ] Only ONE link should be active at a time
- [ ] Non-active links should have gray text and border
- [ ] Hover states work correctly (green border on hover)

### Menu Consistency Across Pages

- [ ] Dashboard header matches Transactions header layout
- [ ] Ops page header matches other pages (if applicable)
- [ ] All pages show the same navigation menu
- [ ] Country selector appears on all pages
- [ ] Logo and subtitle consistent across pages

### Keyboard Navigation (Accessibility)

- [ ] Press `Tab` key → Should cycle through all navigation links in order
- [ ] Each link shows focus state (visible outline or highlight)
- [ ] Press `Enter` on focused link → Should navigate to that page
- [ ] Press `Shift+Tab` → Should cycle backwards through links
- [ ] Country selector accessible via keyboard
- [ ] All interactive elements reachable via keyboard

---

## Task 19: Filter Functionality Comprehensive Testing

### Individual Filter Tests

#### Date Preset Filters

- [ ] Click "Last 7 Days" → Shows transactions from last 7 days only
- [ ] Click "Last 30 Days" → Shows transactions from last 30 days only
- [ ] Click "This Month" → Shows transactions from 1st of current month to today
- [ ] Click "Last Month" → Shows all transactions from previous calendar month
- [ ] Click "Last Quarter" → Shows transactions from previous 3-month quarter
- [ ] Click "This Year" → Shows transactions from Jan 1 to today
- [ ] Click "Last Year" → Shows all transactions from previous year
- [ ] Selected preset button shows green background (active state)

#### Custom Date Range

- [ ] Click "Custom" preset → Shows "From Date" and "To Date" input fields
- [ ] Enter "From Date" only → Shows all transactions from that date onwards
- [ ] Enter "To Date" only → Shows all transactions up to that date
- [ ] Enter both dates → Shows transactions within that range
- [ ] Invalid date range (from > to) → Should handle gracefully
- [ ] Empty custom dates with "Custom" selected → Should show error or all data

#### Category Filter

- [ ] Select "All Categories" → Shows all transactions
- [ ] Select specific category (e.g., "Groceries") → Shows only that category
- [ ] Category dropdown includes all available categories
- [ ] "Uncategorized" option present if applicable
- [ ] Selected category displays correctly in dropdown after filtering

#### Transaction Type Filter

- [ ] Select "All Transactions" → Shows both debits and credits
- [ ] Select "Debits Only" → Shows only debit transactions (negative amounts in red)
- [ ] Select "Credits Only" → Shows only credit transactions (positive amounts in green)
- [ ] Transaction count updates correctly for each type

#### Amount Range Filters

- [ ] Enter Min Amount only (e.g., 50) → Shows transactions ≥ 50
- [ ] Enter Max Amount only (e.g., 1000) → Shows transactions ≤ 1000
- [ ] Enter both Min and Max → Shows transactions within range
- [ ] Min > Max → Should handle gracefully
- [ ] Negative amounts → Should work with absolute values
- [ ] Decimal amounts (e.g., 12.50) → Should work correctly

### Combined Filter Tests

Test multiple filters simultaneously:

- [ ] **Category + Date Range:** Select "Groceries" + "This Month" → Shows only groceries this month
- [ ] **Transaction Type + Amount:** "Debits Only" + Min Amount 100 → Shows debits over 100
- [ ] **All Filters Combined:** Select category, date range, type, and amount → Shows correctly filtered results
- [ ] **Clear Filters button:** Click "Clear Filters" → Resets all filters to defaults and shows all data

### URL Parameter Persistence

- [ ] Apply filters → Check URL contains all filter parameters
- [ ] Copy URL and paste in new tab → Should show same filtered view
- [ ] Refresh page (F5) → Filters remain applied
- [ ] Navigate away and click back button → Filters persist
- [ ] Bookmark filtered URL → Reopening bookmark shows same filters

### Filter Form Submission

- [ ] Click "Apply Filters" button → Submits form and updates results
- [ ] Press Enter in any input field → Submits form
- [ ] Form submits without page flash or flicker
- [ ] Loading state visible during filter application (if applicable)

### Pagination with Filters

- [ ] Apply filters with >50 results → Pagination shows correct page count
- [ ] Click page 2 → URL includes both page=2 and all filter params
- [ ] Filters remain active across pagination
- [ ] Refresh on page 2 → Still shows page 2 with filters
- [ ] Change filters from page 2 → Resets to page 1 with new filters

---

## Task 20: P&L Calculation Testing

### P&L Accuracy with Known Data

**Setup Test Scenarios:**

1. **Scenario A: Only Credits (Income)**
   - [ ] Filter to show only credit transactions
   - [ ] Manually calculate: sum of all credit amounts
   - [ ] P&L card should show: `+[sum]` in green

2. **Scenario B: Only Debits (Expenses)**
   - [ ] Filter to show only debit transactions
   - [ ] Manually calculate: sum of all debit amounts (as negative)
   - [ ] P&L card should show: `-[sum]` in red

3. **Scenario C: Mixed Credits and Debits**
   - [ ] Apply filters with both types
   - [ ] Manually calculate: sum(credits) - sum(debits)
   - [ ] P&L card should match calculated value
   - [ ] Color should be green if positive, red if negative

4. **Scenario D: No Transactions**
   - [ ] Apply filters that return 0 results
   - [ ] P&L should show: `0.00` or not display

### P&L Edge Cases

- [ ] **Large amounts:** Transactions >£10,000 → P&L calculates correctly
- [ ] **Decimal precision:** Amounts like £12.99 → P&L shows correct decimals
- [ ] **Negative credits:** If credit with negative value exists → P&L handles correctly
- [ ] **Different currencies:** Mix of GBP and INR → P&L shows correct currency symbol

### P&L with Different Timeframes

- [ ] **Last 7 Days P&L:** Apply filter → P&L matches sum for that period
- [ ] **This Month P&L:** Apply filter → P&L matches current month sum
- [ ] **This Year P&L:** Apply filter → P&L matches YTD sum
- [ ] **Custom Date Range P&L:** Apply custom dates → P&L matches that range

### P&L Formula Verification

**Expected Formula:** `P&L = SUM(credits) - SUM(debits)`

- [ ] Use calculator to verify at least 3 different filter combinations
- [ ] Check SQL query in code matches formula:
  ```sql
  SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END)
  ```

---

## Task 21: Dashboard Real Data and Responsive Testing

### Dashboard vs Transactions Data Consistency

**Monthly Spend Verification:**

1. [ ] Note "Monthly Spending" value on Dashboard (e.g., £1,250.00)
2. [ ] Navigate to Transactions page
3. [ ] Apply filter: "This Month" + "Debits Only"
4. [ ] Calculate total from displayed transactions
5. [ ] **Verify:** Dashboard monthly spend = Transactions page total debit sum

**Category Breakdown Verification:**

1. [ ] Note top 4 categories on Dashboard (e.g., Groceries £400, Transport £200, etc.)
2. [ ] Navigate to Transactions page
3. [ ] Filter by "This Month" + each category individually
4. [ ] **Verify:** Each category amount matches Dashboard breakdown

**Spending Trend Chart Verification:**

1. [ ] Check 12-month trend chart on Dashboard
2. [ ] Navigate to Transactions page
3. [ ] For each of the last 12 months, apply custom date filter
4. [ ] **Verify:** Transaction totals match chart data points (spot check 3-4 months)

### Country Selector Testing

**Switch from UK to India:**

- [ ] Dashboard showing UK data initially (£ symbol)
- [ ] Change country selector to "🇮🇳 India (INR)"
- [ ] Page reloads with India data (₹ symbol)
- [ ] Monthly spend updates to India transactions only
- [ ] Category breakdown shows only Indian categories
- [ ] 12-month trend updates to Indian data

**Switch from India to UK:**

- [ ] Dashboard showing India data (₹ symbol)
- [ ] Change country selector to "🇬🇧 United Kingdom (GBP)"
- [ ] Page reloads with UK data (£ symbol)
- [ ] All metrics update to UK transactions only

**Country Selector on Transactions Page:**

- [ ] Change country on Transactions page
- [ ] Transaction list updates to show only selected country's data
- [ ] Currency symbols update (£ or ₹)
- [ ] Filters remain applied after country switch

### Responsive Design Testing

#### Desktop (1920x1080+)

- [ ] Dashboard: 3-column grid for supporting cards
- [ ] Dashboard: Hero card spans full width
- [ ] Transactions: Table displays all columns without horizontal scroll
- [ ] Navigation: All menu items visible in single row
- [ ] No layout breaks or overlapping elements

#### Tablet (768px - 1024px)

- [ ] Dashboard: Cards may stack to 2 columns or 1 column
- [ ] Dashboard: Content remains readable
- [ ] Transactions: Table may have horizontal scroll (expected)
- [ ] Navigation: Menu items may wrap to second row
- [ ] Country selector remains accessible
- [ ] Filter form responsive (inputs stack vertically)

#### Mobile (< 768px)

- [ ] Dashboard: All cards stack vertically (1 column)
- [ ] Dashboard: Hero card padding reduces (32px instead of 48px)
- [ ] Dashboard: Hero value font size reduces (36px instead of 56px)
- [ ] Dashboard: YTD stats stack vertically
- [ ] Transactions: Table has horizontal scroll
- [ ] Transactions: Filter inputs stack vertically
- [ ] Transactions: Date preset buttons stack vertically
- [ ] Transactions: Pagination buttons stack and remain usable
- [ ] Navigation: Header stacks vertically
- [ ] Navigation: Country selector full width
- [ ] All text remains legible (min 12px font size)
- [ ] All buttons remain tappable (min 44px touch target)

### Pagination and Edge Cases

**Pagination Tests:**

- [ ] Page 1 shows transactions 1-50
- [ ] Click "Next" → Shows transactions 51-100
- [ ] Click "Last" → Jumps to final page
- [ ] Click "Previous" → Goes back one page
- [ ] Click "First" → Returns to page 1
- [ ] Direct page number links work (click "3" → page 3)
- [ ] Current page highlighted in green
- [ ] Pagination controls disable appropriately (no "Previous" on page 1)

**Edge Cases:**

- [ ] **0 transactions:** Empty state shows "No transactions found" message
- [ ] **Exactly 50 transactions:** Single page, no pagination
- [ ] **51 transactions:** Shows 2 pages (50 on page 1, 1 on page 2)
- [ ] **1000+ transactions:** Pagination works smoothly, no performance issues
- [ ] **Page number out of range:** Navigate to `/dashboard/transactions?page=999` → Redirects to valid page or shows empty

### Cross-Browser Testing

**Chrome/Safari (Primary):**

- [ ] All features work correctly
- [ ] No console errors
- [ ] Smooth animations and transitions

**Firefox:**

- [ ] All features work correctly
- [ ] Date pickers display correctly
- [ ] CSS grid layouts display properly

**Edge:**

- [ ] All features work correctly
- [ ] No layout issues

**Mobile Safari (iOS):**

- [ ] Touch interactions work smoothly
- [ ] Date pickers use native iOS picker
- [ ] No 300ms tap delay
- [ ] Sticky header works correctly

**Chrome Mobile (Android):**

- [ ] Touch interactions work smoothly
- [ ] Date pickers work correctly
- [ ] Performance is acceptable

---

## Console Errors Check

On EVERY page:

- [ ] Open browser DevTools (F12)
- [ ] Check Console tab
- [ ] **Verify:** No red errors displayed
- [ ] **Verify:** No 404 errors for assets
- [ ] **Verify:** No JavaScript errors

---

## Performance Testing

- [ ] Dashboard loads in < 2 seconds (with ~100 transactions)
- [ ] Transactions page loads in < 2 seconds (with ~1000 transactions)
- [ ] Filtering applies in < 1 second
- [ ] Pagination navigation is instant
- [ ] No janky animations or layout shifts
- [ ] Smooth scrolling on mobile

---

## Data Integrity Checks

- [ ] All amounts display with 2 decimal places
- [ ] Currency symbols correct (£ for UK, ₹ for India)
- [ ] Dates formatted correctly (localized)
- [ ] Negative debits show red, positive credits show green
- [ ] Categories match actual transaction categories
- [ ] Bank names display correctly

---

## Security Testing

- [ ] Cannot access `/dashboard` without login → Redirects to `/login`
- [ ] Cannot access `/dashboard/transactions` without login → Redirects to `/login`
- [ ] Cannot see other users' transactions (if multi-user system)
- [ ] SQL injection attempts in filters fail gracefully
- [ ] XSS attempts in search fields are sanitized

---

## Automated Tests Status

```bash
npm test
```

**Expected Output:**
```
Test Suites: 7 passed, 7 total
Tests:       32 passed, 32 total
```

- [x] All 32 automated tests passing ✅

---

## Bug Tracking

**Found Bugs:**

| # | Description | Severity | Page | Status |
|---|-------------|----------|------|--------|
| 1 |             |          |      |        |
| 2 |             |          |      |        |
| 3 |             |          |      |        |

---

## Test Completion Sign-Off

- [ ] **Task 18 Complete:** All navigation links tested and working
- [ ] **Task 19 Complete:** All filters tested individually and in combination
- [ ] **Task 20 Complete:** P&L calculations verified accurate
- [ ] **Task 21 Complete:** Dashboard data matches transactions, responsive design works

**Tested By:** _____________
**Date:** _____________
**Ready for Merge:** [ ] Yes [ ] No

---

## Next Steps After Testing

1. If all tests pass → Ready to merge to `main`
2. If bugs found → Document in table above, create GitHub issues
3. Fix critical bugs before merge
4. Schedule user acceptance testing (UAT) session
5. Deploy to Railway staging environment
6. Final production deployment

---

**Notes:**
- Take screenshots of any bugs or unexpected behavior
- Document browser versions tested
- Note any performance issues
- Suggest UX improvements if found
