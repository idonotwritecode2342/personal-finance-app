# Personal Finance - Mission Control System

## Project Overview

A comprehensive personal finance platform designed as a "mission control system" for tracking all aspects of financial health across multiple countries (UK and India). Built for shared household finance management with intelligent automation and insights.

**Key Users:** Tanveer and wife (shared single login)

---

## Vision & Long-Term Features

The application will eventually capture and optimize every aspect of financial position:

### Asset Tracking
- **Bank Accounts**: Multiple accounts per institution (checking, savings, credit_card, NRO, NRE, FD)
- **Investments**: Stocks, ETFs, mutual funds, pensions — user provides initial + current value
- **Institutions**: Banks and brokers with country association (HSBC UK ≠ HSBC India, Zerodha, Vanguard)
- **Goals**: Savings targets, investment targets, net worth milestones with deadline tracking
- **Real-time Balances**: Auto-calculated on transaction changes + daily snapshots
- Property and mortgage management (future phase)
- Cryptocurrency holdings (future phase)

### Intelligence & Automation
- **Live price tracking** for stocks, ETFs, and crypto with real-time portfolio valuation
- **Automatic index optimization** - system suggests when and what indices to buy
- **Monthly snapshots** - automatically captures entire financial position for net worth progression tracking
- **Savings analytics** - tracks and provides feedback on monthly spend patterns and savings habits
- **Budget automation** - feeds savings into automated ETF purchases and bank transfers
- **Investment returns** - tracks performance per investment and holistically
- **FIRE calculator** - automatic dashboard for early retirement planning
- **Capital gains** - automatic FIFO calculations for tax optimization

### Multi-Country Support
- UK and India financial tracking in native currencies (GBP/INR)
- International asset and currency support
- Multi-currency reporting and conversions
- Country-specific features (tax, pension systems, etc.)

### Reporting & Insights
- Monthly net worth tracking with email updates
- Spending category breakdowns
- Investment performance comparisons
- Savings rate analysis
- Budget vs. actual tracking
- Tax-optimized reporting

---

## MVP 1.0 (Current Focus)

### Completed Design: 2026-02-01
See `/docs/plans/2026-02-01-mvp-1-0-design.md` for full design document.

**Core MVP Features:**
1. Dashboard with summary cards (spend, income, savings, investments)
2. Country selector toggle (UK/India)
3. PDF statement upload with auto-detection
4. LLM-powered transaction extraction
5. Transaction categorization (auto-suggested + manual)
6. Settings/Ops page for:
   - Bank account management
   - Category customization
   - PDF uploads

**Tech Stack:**
- Backend: Node.js + Express
- Database: PostgreSQL (Railway)
- LLM: OpenRouter + Mistral (structured extraction)
- Testing: Jest, Supertest, Playwright
- Frontend: HTML/CSS/JS (Express views)

**Testing Requirements:**
- Unit tests (Jest) - 70%+ coverage target
- Integration tests (Jest + Supertest)
- E2E tests (Playwright)

---

## Git Workflow & Branching

**Main branch:** `main` (production-ready code)

**Feature branches required for:**
- Each major feature (auth, dashboard, PDF upload, etc.)
- Infrastructure changes (database schema, config)
- Each sub-feature within MVP phases

**Always ask before starting new branches** - prevents conflicts and coordinates work across features.

---

## Development Guidelines

### Code Style
- Node.js/Express conventions
- ES6+ JavaScript
- Clear variable naming
- Minimal complexity (YAGNI principle)

### Testing Requirements
- All features must have corresponding tests
- E2E tests for user-facing features
- Unit tests for business logic
- Minimum 70% code coverage for MVP 1.0

### Database
- PostgreSQL in Railway
- Schema migrations tracked in git
- Use environment variables for connection strings
- `.env` file contains DATABASE_URL and API keys

### API Keys & Secrets
- Store in `.env` file (never commit)
- OpenRouter key for LLM access
- Railway database credentials

### Deployment
- Automatic deployment from GitHub to Railway
- Test locally before pushing
- Verify on Railway staging/preview
- Production URL: [to be determined]

---

## Key Files & Directories

```
/
├── app.js                          # Main Express app
├── CLAUDE.md                       # This file (project context)
├── AGENTS.md                       # Implementation tracking
├── package.json                    # Dependencies
├── .env                            # Environment variables (local only)
├── docs/
│   └── plans/
│       └── 2026-02-01-mvp-1-0-design.md  # MVP 1.0 design doc
├── routes/                         # Express routes
├── views/                          # HTML templates
├── public/                         # Static assets
└── tests/                          # Test files (to be created)
```

---

## Important Context

### Shared Account Model
- Single login for both users
- All data is shared (no role separation in MVP 1.0)
- Future: could add user roles if needed

### Multi-Country Design
- UK data tracked in GBP
- India data tracked in INR
- Dashboard country toggle filters all views
- Exchange rates stored for reporting

### PDF Processing Pipeline
- User uploads bank statement PDF
- LLM extracts structured transaction data
- Bank account auto-detected (with confirmation)
- Transactions imported with auto-suggested categories
- User can override categories

### Category System
- Starts with 13 seeded categories (with icons and colors)
- User can add custom categories (linked to `user_id`)
- LLM learns from user overrides via `transaction_category_history`
- Category hierarchy supported via `parent_id`

---

## Database Schema Overview

The database is organized into 9 domains with 21+ tables. All schema is managed via versioned migrations in `/db/migrations/`.

### Migrations
- **001_initial_schema.sql** - Core foundation (users, accounts, transactions, categories)
- **002_future_state_schema.sql** - Enhanced features (institutions, balances, investments, goals, AI)
- **003_ai_chat.sql** - AI chat conversations and messages

### Domain 1: Identity & Geo
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`users`** | Authentication & user preferences | `email`, `password_hash`, `display_name`, `default_country_code` |
| **`countries`** | Country codes & currency mapping | `code` (UK, IN), `name`, `currency_code` |
| **`currencies`** | Supported currencies | `code` (GBP, INR, USD, EUR), `name`, `symbol` |
| **`currency_exchange_rates`** | FX conversion rates | `from_currency`, `to_currency`, `rate`, `rate_date`, `source` |

### Domain 2: Institutions & Accounts
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`institutions`** | Banks and brokers by country | `name`, `country_id`, `institution_type` (bank/broker/pension/crypto_exchange), `detection_patterns` (JSONB), `is_active` |
| **`bank_accounts`** | User accounts at institutions | `user_id`, `institution_id`, `country_id`, `account_type`, `account_name`, `confirmed`, `is_active`, `opened_at`, `closed_at`, `notes` |

Seeded institutions: HSBC (UK), Revolut, AMEX, Vanguard (UK); HSBC (IN), ICICI, Zerodha, Groww (IN)

### Domain 3: Account Balances
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`account_balances`** | Real-time and historical balance snapshots | `account_id`, `balance`, `currency`, `as_of_date`, `as_of_time`, `source` (calculated/manual/statement/snapshot) |

### Domain 4: Transactions & Categories
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`transaction_categories`** | System + user-defined spending categories | `name`, `user_id` (NULL=system), `parent_id`, `icon`, `color`, `is_income`, `is_active`, `display_order`, `description` |
| **`transactions`** | Core transaction ledger | `user_id`, `bank_account_id` / `account_id`, `transaction_date`, `amount`, `currency`, `merchant`, `description`, `category_id`, `pdf_upload_id`, `extracted_txn_id`, `notes`, `is_excluded` |
| **`transaction_category_history`** | Audit trail for AI learning | `transaction_id`, `old_category_id`, `new_category_id`, `source` (llm_initial/user_override/bulk_update), `confidence`, `changed_at` |

Seeded categories: Groceries, Utilities, Transport, Entertainment, Dining, Healthcare, Subscriptions, Salary/Income, Savings, Investments, Insurance, Shopping, Fees (all with icons and colors)

### Domain 5: PDF Upload & Extraction
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`pdf_uploads`** | PDF upload metadata and LLM processing | `user_id`, `bank_account_id`, `file_name`, `file_hash`, `file_size_bytes`, `detected_institution_id`, `detection_confidence`, `bank_detected`, `transaction_count`, `upload_status`, `llm_model`, `llm_raw_response` (JSONB), `error_message`, `processed_at`, `uploaded_at` |
| **`extracted_transactions`** | Staging table for transaction review before import | `pdf_upload_id`, `row_index`, `transaction_date`, `amount`, `currency`, `merchant`, `description`, `transaction_type` (debit/credit), `suggested_category_id`, `suggestion_confidence`, `status` (pending/approved/skipped/modified), `user_category_id`, `reviewed_at` |

### Domain 6: Investments
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`investments`** | User investment holdings | `user_id`, `account_id`, `institution_id`, `name`, `symbol`, `investment_type` (stock/etf/mutual_fund/index_fund/pension/property/crypto/fd/bond), `currency`, `initial_value`, `current_value`, `last_valued_at` |
| **`investment_valuations`** | Historical investment values for charts | `investment_id`, `value`, `valued_at` |

### Domain 7: Goals
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`goals`** | Financial targets and milestones | `user_id`, `goal_type` (savings/investment/debt_payoff/net_worth/custom), `name`, `description`, `target_amount`, `current_amount`, `target_date`, `priority`, `status` |
| **`goal_links`** | Connect goals to accounts/investments for progress tracking | `goal_id`, `bank_account_id`, `investment_id`, `allocation_percentage` |

### Domain 8: Analytics & Snapshots
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`monthly_snapshots`** | End-of-month financial position snapshot | `user_id`, `snapshot_date`, `total_income`, `total_expenses`, `total_saved`, `net_worth`, `category_breakdown` (JSONB) |
| **`budgets`** | Category spending budgets per month | `user_id`, `category_id`, `month`, `budget_amount`, `spent_amount`, `currency` |

### Domain 9: AI Chat
| Table | Purpose | Key Fields |
|-------|---------|------------|
| **`ai_conversations`** | Chat session metadata | `user_id`, `title`, `page_context`, `model_used`, `started_at`, `ended_at` |
| **`ai_messages`** | Message history within conversations | `conversation_id`, `user_id`, `role` (user/assistant), `content`, `tokens_used`, `tools_called` (JSONB), `created_at` |

### Key Relationships
```
users ─┬─> bank_accounts ─> transactions ─> transaction_categories
       │        │                 │
       │        └─> account_balances
       │                          └─> transaction_category_history
       │
       ├─> pdf_uploads ─> extracted_transactions
       │
       ├─> investments ─> investment_valuations
       │
       ├─> goals ─> goal_links ─┬─> bank_accounts
       │                        └─> investments
       │
       └─> ai_conversations ─> ai_messages

institutions ─┬─> bank_accounts
              └─> investments
```

### Running Migrations
```bash
# Run all pending migrations
node scripts/migrate.js

# Run legacy schema.sql (backwards compatibility)
node scripts/migrate.js --legacy
```

---

## Design System & Theme

### Color Palette
- **Primary Background**: `#1a1a1a` (darkest)
- **Secondary Background**: `#252525` (elevated surfaces)
- **Tertiary Background**: `#2d2d2d` (interactive elements)
- **Border Color**: `#3a3a3a` (subtle separators)
- **Text Primary**: `#ffffff` (main text)
- **Text Secondary**: `#b0b0b0` (labels, hints)
- **Accent Color**: `#22c55e` (positive metrics, interactions)
- **Accent Dark**: `#16a34a` (hover states)
- **Positive**: `#22c55e` (gains, increases)
- **Negative**: `#ef4444` (losses, decreases)

### Typography
- **Display Metrics**: `Courier New`, monospace (large, precision)
- **Body**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (clean, readable)
- **Metric Values**: `font-size: 24-56px`, `font-weight: 700`, monospace
- **Labels**: `font-size: 11-12px`, `text-transform: uppercase`, `letter-spacing: 1-2px`
- **Card Titles**: `font-size: 14px`, `font-weight: 600`, uppercase

### Card & Spacing System
- **Hero Card Padding**: `48px` (emphasized, large breathing room)
- **Supporting Card Padding**: `32px` (consistent with hierarchy)
- **Grid Gap**: `24px` (comfortable spacing between cards)
- **Border Radius**: `12px` (cards), `6px` (buttons, inputs)
- **Border**: `1px solid #3a3a3a` (subtle, not intrusive)

### Visual Effects
- **Hover States**:
  - Border color changes to `#22c55e`
  - `box-shadow: 0 12px 32px rgba(34, 197, 94, 0.08)`
  - Background shifts to tertiary
- **Animations**:
  - Fade-in: `0.6s ease-out`
  - Staggered cards: `animation-delay` on grid items
  - Smooth transitions: `0.3s ease` on all interactive elements
- **Gradient Accents**:
  - Radial gradient highlights on hero card: `rgba(34, 197, 94, 0.05)`
  - Subtle top-border glow on card hover

### Grid Layout
- **Responsive**: `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`
- **Desktop**: 3 columns for supporting cards
- **Mobile** (< 768px): 1 column, stacked layout
- **Hero Section**: Full width, above grid

### Data Hierarchy
1. **Primary**: Net Worth (large hero card, dominant visual)
2. **Secondary**: 12-month trend chart (large, contextual)
3. **Supporting**: Monthly spending, savings, investments (equal weight, 3-column grid)
4. **Tertiary**: Key metrics within cards (subtle separators, smaller text)

### Aesthetic Direction
- **Style**: Refined minimalism inspired by Sentinel 001 and Quantro dashboards
- **Philosophy**: "Mission Control for Personal Finance" - data-first, uncluttered, clear hierarchy
- **Tone**: Professional, precise, empowering
- **Visual Character**: Dark, technical, with controlled accent color (green for positive)

## Testing Protocol

**At the end of each feature implementation:**
1. All automated tests must pass (npm test)
2. Start the application locally: `npm run dev`
3. Ask the user to manually test the feature
4. Get user approval before merging to main

This ensures quality and user satisfaction before deployment.

## Current Status

**Phase:** MVP 1.0 Foundation Complete - Ready for User Testing
**Last Updated:** 2026-02-01
**Next Step:** Launch locally for user testing, then proceed with next feature

---

## Session Notes

### 2026-02-01 - Initial Design Session
- Completed brainstorming and full design for MVP 1.0
- Defined database schema
- Established testing strategy
- Created design documentation
- Ready to proceed with implementation using Ralph plugin

---

## Future Phases (Post-MVP 1.0)

### Phase 2: Enhanced Tracking
- Stock and ETF portfolio tracking
- Live price integration
- Investment performance metrics

### Phase 3: Automation
- Automatic budget-to-investment transfers
- Monthly snapshot archival
- Email reporting

### Phase 4: Intelligence
- Investment optimization recommendations
- Spending pattern analysis
- FIRE dashboard

### Phase 5: Advanced Features
- Cryptocurrency support
- Property/mortgage tracking
- Tax-optimized reporting
- International assets and currencies

---

## Contact & Support

For questions about project direction or design decisions, refer to:
- Design doc: `/docs/plans/2026-02-01-mvp-1-0-design.md`
- Git commit history for context on decisions
- AGENTS.md for current implementation status
