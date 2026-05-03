# Dashboard

Angular 21 application that serves as the authentication entry point for the Budget App suite. Users log in here and are redirected to the appropriate micro-frontend.

## Tech Stack

- **Angular 21** with standalone components
- **RxJS** — reactive data streams
- **Karma / Jasmine** — unit testing

## Features

- **Login / Logout** — JWT-based authentication flow against the Rust backend
- **Auth Guard** — protects the home route; redirects unauthenticated users to `/login`
- **Home** — landing page after successful login

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

The app will be available at `http://localhost:4200`.

> **Docker:** When running via `docker-compose`, this app is the primary entry point served on port **4200**.

## Available Scripts

| Script          | Description                       |
| --------------- | --------------------------------- |
| `npm start`     | Start dev server on port 4200     |
| `npm run build` | Production build into `dist/`     |
| `npm test`      | Run unit tests with Karma         |
| `npm run lint`  | Lint with ESLint + angular-eslint |

## Docker

```bash
# Development (hot-reload)
docker compose up frontend-dashboard

# Production image
docker build -t budget-dashboard .
```

## Project Structure

```
src/app/
├── login/          # Login form component
├── logout/         # Logout handler component
├── home/           # Protected home page
├── guards/         # authGuard — JWT session check
└── services/       # Auth service (login, token storage)
```
