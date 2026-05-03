# List App

Angular 21 application for managing collaborative to-do and shopping lists. Supports drag-and-drop reordering, sub-items, repeating items, and list sharing via shareable tokens.

## Tech Stack

- **Angular 21** with standalone components
- **Angular CDK** — drag-and-drop (`DragDropModule`)
- **RxJS** — reactive data streams
- **Karma / Jasmine** — unit testing

## Features

- **Lists** — create and manage multiple named lists per user
- **List Items** — add, edit, reorder (drag-and-drop), and complete items
- **Sub-items** — nested checklist items within each list item
- **Repeating Items** — configure items to recur on a schedule (daily, weekly, etc.)
- **Sharing** — share lists with other users via a generated token link (`/share/:token`)
- **Members Panel** — view and manage authorized list members
- **Auth Guard** — all routes require a valid JWT session

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

> **Docker:** When running via `docker-compose`, the app is served on port **4202**.

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
docker compose up frontend-list

# Production image
docker build -t budget-list .
```

## Project Structure

```
src/app/
├── home/               # Lists overview — create and navigate to lists
├── list-detail/        # List view with items, sub-items, drag-and-drop
├── share/              # Accept a share-token invitation
├── login/              # Login form
├── guards/             # authGuard — JWT session check
├── interceptors/       # HTTP interceptors (auth token)
├── models/             # TypeScript interfaces (UserList, ListItem, SubItem, etc.)
├── services/           # ListService, AuthService
└── utils/              # Shared utility functions
```
