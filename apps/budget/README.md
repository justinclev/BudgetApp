# Budget Frontend

Angular 20 application for personal budget management. Provides views for tracking debts, recurring transactions, and individual transactions, plus a loan comparison calculator.

## Tech Stack

- **Angular 20** with standalone components
- **Angular Material** — UI component library
- **RxJS** — reactive data streams
- **Karma / Jasmine** — unit testing

## Features

- **Dashboard** — overview of debts and recurring transactions
- **Debt Management** — list, create, edit, and delete debts with interest rate and payment tracking
- **Loan Comparison** — side-by-side comparison of loan payoff strategies
- **Recurring Transactions** — manage scheduled income/expense entries
- **Transaction History** — view generated transactions linked to debts and recurring items

## Development

### Prerequisites

- Node.js 18+
- Angular CLI (`npm install -g @angular/cli`)
- `backend_rust` service running on port 3000

### Install dependencies

```bash
npm install
```

### Start dev server

```bash
npm start
```

The app will be available at `http://localhost:4200` (proxied to the backend via `proxy.conf.json`).

> **Docker:** When running via `docker-compose`, the app is served on port **4201**.

## Available Scripts

| Script | Description |
|---|---|
| `npm start` | Start dev server on port 4200 |
| `npm run build` | Production build into `dist/` |
| `npm test` | Run unit tests with Karma |
| `npm run lint` | Lint with ESLint + angular-eslint |

## Proxy Configuration

| File | Used when |
|---|---|
| `proxy.conf.json` | Default local dev (`ng serve`) |
| `proxy.conf.local.json` | Local override |
| `proxy.conf.docker.json` | Docker Compose dev environment |
| `proxy.conf.prod.json` | Production build |

## Docker

```bash
# Development (hot-reload)
docker compose up frontend-budget

# Production image
docker build -t budget-frontend .
```

## Project Structure

```
src/app/
├── dashboard/                  # Home dashboard view
├── debt-detail/                # Debt create/edit form
├── list-debt/                  # Debt list view
├── loan-comparison/            # Loan comparison calculator
├── recurring-transaction-detail/
├── list-recurring-transaction/
├── list-transactions/
├── transaction-detail/
├── models/                     # Shared TypeScript interfaces
├── services/                   # HTTP services (debt, transaction, auth, etc.)
├── interceptors/               # HTTP interceptors (auth token)
└── shared/                     # Shared components
```
