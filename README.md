# My Personal Finances

#### Video Demo: <VIDEO_URL_AFTER_RECORDING>

#### Live Demo: <https://cs50-personal-finances.pages.dev>

#### Description

My Personal Finances is a full-stack web application for organizing household finances without depending on a paid budgeting platform. It lets people maintain separate profiles, register monthly income and expenses, inspect dashboard summaries and charts, build an emergency reserve, define savings goals, and optionally import transactions through an Open Finance provider. The interface is written in Portuguese because the project was designed around the needs of Brazilian users.

This repository is the isolated CS50 edition of the application. It contains synthetic demo profiles and transactions and uses a Cloudflare D1 database that is separate from the author's private production database. No real bank record, CPF, access token, session secret, or personal financial value is included. The deployed demo can be explored with either profile and the demonstration PIN `2026`.

The main problem the project addresses is fragmentation. A person may have income in one place, card purchases in another, long-term goals in a spreadsheet, and no simple view of how those pieces affect the current month. My Personal Finances puts those concepts into one model and makes the relationship between cash flow, categories, reserves, and goals visible. The project goes beyond merely storing rows: it normalizes transactions, prevents duplicate imports, calculates financial indicators, supports recurring records, and preserves a user's corrected category when the same transaction is imported again.

## Core Features

- Profile-based access with signed, HTTP-only session cookies.
- Monthly income and expense registration, including recurring entries.
- Filters for month, category, profile, and payment method.
- Dashboard totals, category distribution, balance progression, and deterministic saving suggestions.
- Savings goals with deadlines, priorities, contributions, and progress calculations.
- Reserve entries for emergency funds and other protected amounts.
- Editable transaction categories and reusable automatic categorization rules.
- Optional per-profile Open Finance connections, incremental synchronization, and deduplication.
- Dark and light themes with persistent accent-color preferences.
- Responsive navigation for both desktop and mobile-sized screens.

## Technology and Architecture

The frontend uses React, TypeScript, Vite, Tailwind CSS, Recharts, and Lucide icons. React owns the interface and local interaction state, while all persistent or sensitive operations go through Cloudflare Pages Functions. Those server-side functions validate requests, check authentication, query Cloudflare D1 using prepared statements, and return JSON responses. D1 provides a SQLite-compatible relational model that works well for a small personal application and remains within Cloudflare's free tier.

The application intentionally keeps secrets out of the browser. The session secret, optional application PIN, encryption key, and Open Finance credentials are Cloudflare secrets or local `.dev.vars` values. Profile sessions are signed on the server and stored in HTTP-only cookies. Open Finance tokens, when the optional integration is configured, are encrypted before being saved and are never returned to the frontend.

The data flow is:

1. A React page calls a typed helper in `src/lib/api.ts`.
2. A route under `functions/api` authenticates and validates the request.
3. The route executes prepared D1 statements or delegates domain logic to `functions/_shared`.
4. The response updates React state and the dashboard recomputes the visible totals.

This separation was chosen so that the browser never connects directly to the database and business rules are not duplicated across pages.

## Files and Directories

### Frontend

- `index.html` is the Vite HTML entry point and contains the metadata used when the application is installed as a PWA.
- `src/main.tsx` mounts React and loads the global stylesheet.
- `src/App.tsx` coordinates authentication, profile selection, routing, and the main application shell.
- `src/index.css` defines Tailwind integration, color tokens, typography, responsive behavior, and shared visual states.
- `src/pages/Dashboard.tsx` presents monthly totals, charts, recent transactions, and the generated financial insights.
- `src/pages/Income.tsx` handles monthly income and recurring-income records.
- `src/pages/Expenses.tsx` creates and filters expenses, including recurring series and payment methods.
- `src/pages/Transactions.tsx` combines manually entered and imported transactions and exposes category correction tools.
- `src/pages/Goals.tsx` manages savings goals, deadlines, contributions, participants, and budget allocation.
- `src/pages/Reserve.tsx` manages emergency reserves and other protected balances.
- `src/pages/Settings.tsx` manages profiles, PIN changes, categories, theme preferences, and optional Open Finance connections.
- `src/components/FinanceInsights.tsx` renders deterministic observations about spending and possible savings; it does not send financial data to a generative model.
- `src/components/TransactionCategoryEditor.tsx` lets the user recategorize one transaction or apply the same decision to similar transactions.
- `src/components/AtualizarDadosButton.tsx` starts an Open Finance synchronization and communicates progress and errors.
- `src/components/layout` contains the authenticated header, bottom navigation, and login screen.
- `src/components/ui` contains reusable buttons, cards, inputs, selectors, modals, tabs, loading states, error states, and chart containers.
- `src/lib/api.ts` is the typed browser-to-server API client.
- `src/lib/analytics/financeInsights.ts` calculates the dashboard's explainable saving suggestions.
- `src/lib/openFinanceFlow.ts` coordinates the browser portion of the optional consent flow.
- `src/lib/format.ts` centralizes currency, percentage, and date formatting.
- `src/lib/theme.ts` and `src/hooks/useTheme.ts` implement persistent theme and accent selection.
- `src/types/finance.ts` defines the domain types shared by pages and components.

### Server-side Functions

- `functions/api/auth` contains login, logout, profile discovery, and session-status endpoints.
- `functions/api/dashboard.ts` aggregates income, expenses, balance, categories, and recent activity for the selected period.
- `functions/api/monthly-income.ts`, `expenses.ts`, `transactions.ts`, and `reserve-entries.ts` implement the principal CRUD operations.
- `functions/api/savings-goals.ts` and the nested goal routes manage contributions, budget items, and goal allocations.
- `functions/api/categories.ts`, `category-rules.ts`, and the transaction-category routes implement user-controlled categorization.
- `functions/api/openfinance` contains consent, callback, connection, synchronization, and reprocessing endpoints. These routes are optional and remain inactive without provider credentials.
- `functions/_shared/auth.ts` signs sessions, verifies profile PINs, and protects private endpoints.
- `functions/_shared/http.ts` standardizes JSON responses, error responses, and request parsing.
- `functions/_shared/recurrence.ts` expands and edits recurring income or expense series while preserving past records.
- `functions/_shared/goals.ts` contains reusable calculations and validation for savings goals.
- `functions/_shared/category-normalizer.ts` and `openfinance/categorization.ts` normalize descriptions and select deterministic categories.
- `functions/_shared/openfinance/dedupe.ts` builds stable deduplication keys when a provider does not supply a reliable transaction ID.
- `functions/_shared/openfinance/sync.ts` implements the incremental import window and keeps user-selected categories intact.
- `functions/_shared/openfinance/connections.ts`, `crypto.ts`, and `cumbucaMcpClient.ts` isolate encrypted credentials and provider communication.
- `functions/_shared/types.ts` and `db-schema.ts` describe the server environment and database records.

### Database, Configuration, and Validation

- `migrations/0001_initial_schema.sql` creates profiles, income, expenses, goals, reserves, categories, indexes, and update triggers.
- `migrations/0002_profile_pins_and_recurrence.sql` adds salted profile PINs and recurrence metadata.
- `migrations/0003_open_finance.sql` adds imported transactions and synchronization state.
- `migrations/0004_category_preprocessing_goals_objectives.sql` adds category rules and richer goal modeling.
- `migrations/0005_open_finance_connections_per_profile.sql` separates encrypted provider connections by profile.
- `migrations/0006_shared_goal_allocation_and_cumbuca_consent.sql` adds shared-goal participation, allocations, and temporary OAuth consent state.
- `migrations/0007_cs50_demo_data.sql` inserts only synthetic profiles, income, goals, reserves, and historical records.
- `migrations/0008_current_month_demo_expenses.sql` keeps a set of synthetic expenses in the current calendar month so the dashboard remains useful when evaluated later.
- `scripts/test-openfinance.ts` tests normalization, category preservation, and deduplication without contacting a real bank.
- `wrangler.toml` describes the isolated Cloudflare Pages and D1 deployment.
- `package.json` defines development, validation, migration, and deployment commands.
- `.dev.vars.example` documents local-only secrets without containing usable credentials.

## Important Design Decisions

I chose server-side Pages Functions instead of calling D1 or Open Finance from React because browser code cannot safely hold credentials. Prepared D1 statements also keep SQL parameters separate from queries. Signed HTTP-only cookies were selected over local-storage tokens so JavaScript cannot directly read the session credential.

Imported transactions store both an original category and a user category. This matters because an automated import should never erase a correction made by the person using the app. Synchronization overlaps the previous successful window by three days and then deduplicates results. The overlap protects against providers that post or revise transactions late, while the stable key prevents the same transaction from appearing twice.

The financial insights are deterministic rather than generative. Each observation can be traced to visible totals or category changes, which is more appropriate for sensitive financial information and avoids presenting probabilistic text as financial advice.

The CS50 deployment uses synthetic profiles and a separate database. This was a deliberate privacy decision: a public demonstration should prove the software's behavior without copying the author's household data or requiring an evaluator to connect a bank account.

## Running Locally

Requirements: Node.js 20 or newer and a Cloudflare account for full Pages Functions and D1 emulation.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run d1:migrate:local
npm run pages:dev
```

Set a strong local `SESSION_SECRET` in `.dev.vars`. The seeded demonstration profiles use PIN `2026`. Frontend-only work can be started with `npm run dev`, but persistent operations require `npm run pages:dev`.

## Validation

```bash
npm run lint
npm run test:openfinance
npm run build
```

The build command type-checks both the React application and the Cloudflare Functions before producing the static assets in `dist`.

## AI Assistance and Academic Honesty

OpenAI Codex was used to help migrate the author's existing application into this isolated CS50 repository, sanitize demo data, improve comments and documentation, and review configuration. Assisted source files contain an explicit AI-assistance citation in their comments. The application's problem definition, feature selection, data model, product decisions, and responsibility for the submitted work remain with Matheus Lira.
