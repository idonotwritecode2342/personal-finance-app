# MVP 1.0 Implementation Tracking

**Start Date:** 2026-02-01
**Status:** Foundation Complete - Awaiting User Testing

## Testing Protocol

**At the end of each feature implementation, follow this protocol:**

1. ✅ All automated tests pass: `npm test`
2. ✅ Start application locally: `npm run dev`
3. ✅ Ask user to manually test the feature
4. ✅ Get user approval and feedback
5. ✅ Make any necessary adjustments
6. ✅ Merge to main branch
7. ✅ Deploy to Railway

**Do NOT proceed to the next feature until user has tested and approved current feature.**

## Design System - Core Theme (Established)

All UI development must adhere to this design system. See CLAUDE.md for full theme specifications.

### Quick Reference for Developers
- **Dark Theme**: `#1a1a1a` (bg) → `#252525` (elevated) → `#2d2d2d` (interactive)
- **Accent**: `#22c55e` (green) for positive metrics and hover states
- **Typography**: Courier New for metrics, system sans-serif for body
- **Cards**: 32px padding, subtle borders, 24px gaps, hover glow effect
- **Responsive**: 3-column grid (desktop) adapts to 1-column (mobile < 768px)
- **Animations**: 0.3s ease transitions, staggered reveals on page load
- **Hierarchy**: Large monospace metrics, uppercase labels, subtle separators

**When building new features:**
1. Reuse established colors (don't add new ones)
2. Follow card component pattern (icon + title + metrics + separators)
3. All numeric values in monospace font
4. Test responsiveness on mobile
5. Use CSS variables for theming consistency

## Feature Implementation Checklist

### Phase 1: Foundation & Database
- [x] Database schema creation (all tables)
- [x] Seeded transaction categories with descriptions (13 categories)
- [x] Database migrations setup (scripts/migrate.js)
- [x] Connection pooling and error handling

### Phase 2: Authentication & User Management
- [x] User registration
- [x] User login/logout
- [x] Session management (express-session + PostgreSQL store)
- [x] Password hashing (bcryptjs)
- [x] Auth middleware for protected routes

### Phase 3: Dashboard & Core UI
- [x] Dashboard page layout and styling (responsive design)
- [x] Summary cards (Spend, Income, Savings, Investments)
- [x] Country selector toggle (UK/India)
- [x] Recent transactions display (last 10)
- [x] Dashboard data aggregation logic

### Phase 4: Bank Account Management
- [ ] Bank account creation (manual)
- [ ] Bank account auto-detection from PDF
- [ ] Account confirmation flow
- [ ] Account listing and editing
- [ ] Account name customization

### Phase 5: PDF Upload & Extraction
- [ ] PDF file upload endpoint
- [ ] PDF text extraction library integration
- [ ] OpenRouter + Mistral LLM integration
- [ ] Structured transaction extraction
- [ ] Transaction preview and confirmation
- [ ] Error handling for failed extractions

### Phase 6: Transaction Categorization
- [ ] Auto-category suggestion from LLM
- [ ] Category management CRUD
- [ ] Custom category creation
- [ ] Manual category override on transactions
- [ ] Category assignment UI in upload preview

### Phase 7: Settings/Ops Page
- [ ] Ops page main navigation
- [ ] Upload PDF sub-page
- [ ] Categories management sub-page
- [ ] Banks management sub-page
- [ ] Navigation between sub-sections

### Phase 4: Testing (MVP 1.0 Foundation)
- [x] Unit tests for core logic (20 tests passing)
- [x] Database function tests (db/users.js, db/dashboard.js) - 100% coverage
- [x] Jest configuration with coverage reporting
- [x] Auth flow unit tests
- [ ] Integration tests for API endpoints
- [ ] E2E tests with Playwright
- [ ] Test data seeding
- [ ] CI/CD pipeline setup

**Current Coverage:** 82% on db module, 100% on core functions

### Phase 9: Deployment & Polish
- [ ] Railway deployment verification
- [ ] Environment variables configured
- [ ] Error logging setup
- [ ] Performance optimization
- [ ] UI/UX polish

---

## Git Branches

**Main Branch:** `main` (production-ready)

**Active Feature Branches:**
(To be created before implementation starts - always ask user before creating new branches)

Example structure:
- `feature/auth` - Authentication system
- `feature/dashboard` - Dashboard page and cards
- `feature/pdf-upload` - PDF upload and extraction
- `feature/categories` - Transaction categories
- `feature/settings` - Settings/Ops page
- `feature/testing` - Test suite setup

---

# Railway Services

The project has two services in Railway under the **Personal Finance** project:

1. **Personal Finance Postgres** - The database service
   - Use `railway link` and select this service to get database credentials
   - Contains all environment variables for DB connection (DATABASE_URL, PGHOST, etc.)

2. **Personal Finance Node.js** - The application service
   - The deployed web application
   - Automatically deploys when you push to GitHub

# Database Configuration

Do not set up a local Postgres database. Always link to the production Railway database.
**Dev and prod use the same DB.**

To fetch environment variables from Railway and save locally:
```bash
railway link  # Select "Personal Finance Postgres" service
railway variables -k > .env
```

Use `DATABASE_PUBLIC_URL` for local development (public proxy endpoint).

# Testing Instructions

You have two methods to test:

1. **Local Testing**: It's always deployed locally. Open up the web browser; you should be able to see what you've been working on.

2. **GitHub & Railway Deployment**:
   - Commit changes to GitHub with a short description of what to expect
   - Railway will automatically detect the push and deploy
   - Use Railway CLI for verification (project: `personal finance`)
   - Once deployed, test the final link on Railway

---

## Implementation Notes

### Environment Setup
Required `.env` variables:
- `DATABASE_URL` - PostgreSQL connection string from Railway
- `DATABASE_PUBLIC_URL` - Public proxy endpoint for local dev
- `OPENROUTER_API_KEY` - For LLM transaction extraction
- `SESSION_SECRET` - For session management
- `PORT` - Server port (default: 3000)

### Key Integration Points
- **OpenRouter:** Used for PDF transaction extraction with Mistral
- **PostgreSQL:** All data persistence
- **Railway:** Production deployment

### Testing Strategy
- Jest for unit and integration tests
- Supertest for API endpoint testing
- Playwright for E2E browser testing
- Target 70%+ code coverage for MVP 1.0
