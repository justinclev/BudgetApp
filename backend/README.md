# Backend (Node.js — Legacy)

> **Note:** This service has been superseded by `backend_rust`. It is kept for reference and is not actively maintained.

Original Express/TypeScript backend that backed the early versions of the Budget App. It connects to MongoDB via Mongoose and exposes REST endpoints for recurring transactions and debts.

## Tech Stack

- **Node.js** with **TypeScript**
- **Express 5** — HTTP framework
- **Mongoose 9** — MongoDB ODM
- **dotenv** — environment variable loading
- **nodemon** — dev hot-reload

## API Routes

| Method | Path                                           | Description                    |
| ------ | ---------------------------------------------- | ------------------------------ |
| GET    | `/`                                            | Health check                   |
| GET    | `/api/recurring-transactions`                  | List recurring transactions    |
| POST   | `/api/recurring-transactions`                  | Create a recurring transaction |
| PUT    | `/api/recurring-transactions/:id`              | Update a recurring transaction |
| DELETE | `/api/recurring-transactions/:id`              | Delete a recurring transaction |
| GET    | `/api/recurring-transactions/check-name/:name` | Check name uniqueness          |
| GET    | `/api/debts`                                   | List debts                     |
| POST   | `/api/debts`                                   | Create a debt                  |
| PUT    | `/api/debts/:id`                               | Update a debt                  |
| DELETE | `/api/debts/:id`                               | Delete a debt                  |
| GET    | `/api/debts/check-name/:name`                  | Check name uniqueness          |

## Environment Variables

| Variable    | Default                            | Description               |
| ----------- | ---------------------------------- | ------------------------- |
| `PORT`      | `3000`                             | Port to listen on         |
| `MONGO_URI` | `mongodb://mongo:27017/budget-app` | MongoDB connection string |

## Development

### Install dependencies

```bash
npm install
```

### Run in dev mode (hot-reload)

```bash
npm run dev
```

### Build and run

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── index.ts          # Express app, route definitions
└── models/
    ├── Debt.ts              # Mongoose Debt schema
    └── RecurringTransaction.ts  # Mongoose RecurringTransaction schema
```
