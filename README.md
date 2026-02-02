# Personal Finance
Mission-control dashboard for personal finances with authentication, dashboards, and PostgreSQL persistence.

## Implemented Features
- [x] Authentication: registration, login/logout, session management
- [x] Dashboard: spend, income, savings, investments summary cards
- [x] Recent transactions: last 10 transactions view
- [x] Data layer: PostgreSQL schema, migrations, connection pooling
- [x] Categories: seeded transaction categories with descriptions
- [x] AI assistant: embedded bottom-right chat widget on authenticated pages
- [x] Agent workspace: `/agent` page with conversation history and resume flow
- [x] AI persistence: `ai_conversations` + `ai_messages` tables with tool metadata
- [x] Ops settings: global OpenRouter model selector (`/ops/settings`)
- [x] Shared model config: same selected model used for chat and PDF extraction

## In Progress / TODO
- [ ] Bank accounts: manual creation, listing, editing, naming
- [ ] PDF upload: file upload endpoint, text extraction
- [ ] LLM extraction: improve prompts, robustness, and error-retry behavior
- [ ] Transaction preview & confirmation flow
- [ ] Auto-categorization and category management UI
- [ ] Integration and E2E tests, CI/CD pipeline
- [ ] Deployment verification and performance polish

## Recent Update
- Added OpenRouter-powered chat APIs (`/api/ai/chat`, `/api/ai/conversations`, `/api/ai/conversations/:id/messages`), embedded chat UI, `/agent` page, and DB-backed global model setting (`global_settings.openrouter_model`).
