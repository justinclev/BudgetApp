# Backend (Rust)

Primary REST API for the Budget App, built with Actix-web and MongoDB. Handles authentication, debts, recurring transactions, generated transactions, lists, and todo occurrences.

## Tech Stack

- **Rust** (edition 2021)
- **Actix-web 4** — HTTP framework
- **actix-cors** — CORS middleware
- **MongoDB 2** (async driver) — database
- **BSON / Serde** — serialization
- **JWT (HS256)** — custom lightweight implementation using `hmac` + `sha2` + `base64`
- **Chrono** — date/time handling
- **Dotenv** — environment variable loading

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check |
| POST | `/api/users/login` | Authenticate and receive a JWT |
| GET | `/api/debts` | List debts for the authenticated user |
| POST | `/api/debts` | Create a debt |
| PUT | `/api/debts/:id` | Update a debt |
| DELETE | `/api/debts/:id` | Delete a debt |
| GET | `/api/debts/check-name/:name` | Check debt name uniqueness |
| GET | `/api/recurring-transactions` | List recurring transactions |
| POST | `/api/recurring-transactions` | Create a recurring transaction |
| PUT | `/api/recurring-transactions/:id` | Update a recurring transaction |
| DELETE | `/api/recurring-transactions/:id` | Delete a recurring transaction |
| GET | `/api/lists` | List all lists the user owns or is a member of |
| POST | `/api/lists` | Create a list |
| PUT | `/api/lists/:id` | Update list metadata |
| DELETE | `/api/lists/:id` | Delete a list |
| GET | `/api/generated-transactions` | List generated transactions |
| GET | `/api/todo-occurrences` | List todo occurrences |

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `PORT` | No | `3000` | Port the server listens on |
| `JWT_SECRET` | Yes | — | Secret key for signing JWTs |
| `ALLOWED_ORIGIN` | Production | — | CORS allowed origin |
| `DEV_MODE` | No | `false` | Set to `true` to allow any CORS origin (local dev only) |

> In production (`DEV_MODE` is not `true`), `ALLOWED_ORIGIN` **must** be set or the server will refuse to start.

## Development

### Prerequisites

- Rust toolchain (`rustup` — stable)
- MongoDB instance (local or Atlas)

### Run locally

```bash
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, DEV_MODE=true
cargo run
```

Server starts on `http://localhost:3000`.

### Database seed

```bash
cargo run --bin seed
```

### Docker

```bash
# Via docker-compose (recommended)
docker compose up backend

# Standalone
docker build -t budget-backend-rust .
docker run -p 3000:3000 --env-file .env budget-backend-rust
```

## Project Structure

```
src/
├── main.rs          # Server setup, route registration
├── auth.rs          # JWT creation and extraction (HS256)
├── db.rs            # MongoDB connection, AppState
├── models.rs        # Serde/BSON data models
├── utils.rs         # Custom BSON deserializers
├── handlers/
│   ├── debt_handler.rs
│   ├── transaction_handler.rs        # Recurring transactions
│   ├── generated_transaction_handler.rs
│   ├── list_handler.rs
│   ├── todo_occurrence_handler.rs
│   ├── user_handler.rs               # Login
│   └── health_handler.rs
└── bin/
    └── seed.rs      # Database seeding utility
```
