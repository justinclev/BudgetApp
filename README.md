# BudgetApp Monorepo

Monorepo for the Budget App — a set of micro-frontends and a Rust backend for personal budgeting, lists, and recurring transactions.

This repository contains multiple small apps and utilities used together during development and in Docker Compose for local testing.

## Projects

- `apps/dashboard` — Authentication entrypoint and home app
- `apps/budget` — Main budgeting frontend (debts, recurring transactions, loan comparison)
- `apps/list` — Collaborative lists micro-frontend (sharing, drag-and-drop)
- `backend_rust` — Primary backend (Actix-web + MongoDB)
- `backend` — Legacy Express/TypeScript backend (reference)
- `scripts` — DB migration scripts and utilities

Each subproject includes its own `README.md` with details and run instructions.

## Quick start (recommended)

The easiest way to run the full stack locally is with Docker Compose. From the repository root run:

```bash
# Build and start services (Mongo, backend, frontends)
docker compose up --build
```

After startup:

- Dashboard: http://localhost:4200
- Budget app: http://localhost:4201
- List app: http://localhost:4202
- API: http://localhost:3000

Environment variables are read from the shell or an `.env` file (used by Docker Compose). Important vars include `MONGO_URI`, `JWT_SECRET`, `ALLOWED_ORIGIN` / `ALLOWED_ORIGINS`, and `DEV_MODE`.

## Development (without Docker)

1. Start the Rust backend (requires MongoDB running locally or Atlas):

```bash
cd backend_rust
cp .env.example .env            # fill values
cargo run
```

2. Start a frontend app (example: budget app):

```bash
cd apps/budget
npm install
npm start
```

Repeat for `apps/dashboard` and `apps/list`.

## Database

The repo contains migration utilities in `scripts/`:

- `scripts/migrate.js` — Node.js migration script
- `scripts/migrate-compass.js` — script for MongoDB Compass/mongosh

There is also a seed binary in `backend_rust/bin/seed.rs` you can run with `cargo run --bin seed`.

## Testing

- Frontend unit tests use Karma/Jasmine: `npm test` in the app folder.
- Backend integration tests are not included; run manual tests against the running server.

## Contributing

- Create feature branches off `main`.
- Keep shared models in sync between frontends (`src/app/models`) and the Rust `models.rs` where applicable.
- Run `docker compose up` in dev mode to test full-stack behavior.

## Where to find more info

See the individual READMEs for each subproject:

- `apps/dashboard/README.md`
- `apps/budget/README.md`
- `apps/list/README.md`
- `backend_rust/README.md`
- `backend/README.md`
- `scripts/README.md`
