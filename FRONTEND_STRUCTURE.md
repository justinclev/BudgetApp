# Frontend Apps Structure

This monorepo-style setup allows you to host multiple Angular apps under one Vercel deployment.

## Directory Structure

```
/
├── apps/
│   ├── dashboard/          # Main dashboard app (Vercel entry point)
│   │   ├── src/
│   │   ├── angular.json
│   │   ├── package.json
│   │   └── ...
│   └── budget/             # Budget app (accessible at /budget)
│       ├── src/
│       ├── angular.json
│       ├── package.json
│       └── ...
├── backend/                # Node.js backend
├── backend_rust/           # Rust backend
├── frontend-dev.sh         # Development script
├── vercel.json             # Vercel configuration
└── ...
```

## Running Apps Locally

### Dashboard (Default)
```bash
./frontend-dev.sh dashboard
# or simply
./frontend-dev.sh
```

### Budget App with Local Backend
```bash
./frontend-dev.sh budget local
# Connects to http://localhost:3000
```

### Budget App with Production Backend
```bash
./frontend-dev.sh budget prod
# Connects to https://budgetapp-ma3x.onrender.com
```

## How It Works

1. **Vercel Entry Point**: `vercel.json` points to `apps/dashboard/` as the main build and output
2. **Dashboard**: Main landing page that lists available apps
3. **Routing**: Dashboard routes to `/budget` which lazy-loads the budget app
4. **Shared Backend**: Both apps can connect to the same backend via proxy configuration

## Adding New Apps

1. Create a new Angular app: `ng new apps/my-new-app --routing --style=scss`
2. Add app info to dashboard component (`apps/dashboard/src/app/app.ts`)
3. Add route in dashboard routes (`apps/dashboard/src/app/app.routes.ts`)
4. Update `vercel.json` install command if needed

## Deployment

To deploy to Vercel:
1. Connect your repo to Vercel
2. Vercel will automatically read `vercel.json` and build the dashboard
3. Dashboard and all routed apps will be deployed together
