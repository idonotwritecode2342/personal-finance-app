# Ralph Loop: MVP 1.0 Foundation Implementation

**Task:** Implement MVP 1.0 of the Personal Finance application according to `/docs/plans/2026-02-01-mvp-1-0-design.md`

**Phase 1: Database Schema & Setup**
1. Create all database tables as defined in the design doc
2. Create database migration files for PostgreSQL
3. Seed transaction categories with descriptions
4. Set up connection pooling
5. Test database connectivity

**Phase 2: Authentication System**
1. Install required dependencies (express-session, bcrypt, etc.)
2. Create user model and database operations
3. Implement registration route
4. Implement login/logout routes
5. Add session middleware
6. Create login and registration views

**Phase 3: Dashboard Foundation**
1. Create dashboard route
2. Build dashboard HTML template
3. Add country selector logic
4. Implement data aggregation queries (spend, income, savings, investments)
5. Add styling for summary cards

**Phase 4: Testing Setup**
1. Configure Jest for unit tests
2. Install testing dependencies
3. Create test utilities and helpers
4. Write tests for database functions
5. Write tests for authentication

**Success Criteria:**
- All database tables created and accessible
- Categories seeded with descriptions
- User can register and login
- Dashboard loads with test data
- Country selector works
- Tests pass (70%+ coverage for Phase 1-2)
- Code committed to feature branches

**When complete, output:** <promise>MVP 1.0 FOUNDATION COMPLETE</promise>
