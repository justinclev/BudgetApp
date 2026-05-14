#!/bin/bash

# Script to run frontend apps in development
# Usage: ./frontend-dev.sh [dashboard|budget|list|all] [local|prod]

APP="${1:-dashboard}"
ENV="${2:-local}"

# Validate app
if [[ "$APP" != "dashboard" && "$APP" != "budget" && "$APP" != "list" && "$APP" != "all" ]]; then
    echo "❌ Invalid app: $APP"
    echo "Usage: ./frontend-dev.sh [dashboard|budget|list|all] [local|prod]"
    echo ""
    echo "Apps:"
    echo "  dashboard - Main app dashboard (default)"
    echo "  budget    - Budget app"
    echo "  list      - List app"
    echo "  all       - All three apps"
    echo ""
    echo "Environments:"
    echo "  local - Uses localhost:3000 backend (default)"
    echo "  prod  - Uses https://budgetapp-ma3x.onrender.com backend"
    exit 1
fi

# Validate environment
if [[ "$ENV" != "local" && "$ENV" != "prod" ]]; then
    echo "❌ Invalid environment: $ENV"
    echo "Usage: ./frontend-dev.sh [dashboard|budget|list|all] [local|prod]"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_app() {
    local app="$1"
    local env="$2"
    cd "$SCRIPT_DIR/apps/$app"
    if [[ "$env" == "prod" ]]; then
        npx ng serve --configuration=prod-proxy
    else
        npx ng serve
    fi
}

if [[ "$APP" == "all" ]]; then
    echo "🚀 Starting all apps in $ENV mode..."
    (cd "$SCRIPT_DIR/apps/dashboard" && (([[ "$ENV" == "prod" ]] && npx ng serve --configuration=prod-proxy) || npx ng serve)) &
    PID_DASHBOARD=$!
    (cd "$SCRIPT_DIR/apps/budget" && (([[ "$ENV" == "prod" ]] && npx ng serve --configuration=prod-proxy --port=4201) || npx ng serve --port=4201)) &
    PID_BUDGET=$!
    (cd "$SCRIPT_DIR/apps/list" && (([[ "$ENV" == "prod" ]] && npx ng serve --configuration=prod-proxy --port=4202) || npx ng serve --port=4202)) &
    PID_LIST=$!
    echo "  dashboard PID: $PID_DASHBOARD"
    echo "  budget    PID: $PID_BUDGET"
    echo "  list      PID: $PID_LIST"
    echo ""
    echo "Press Ctrl+C to stop all apps"
    trap "kill $PID_DASHBOARD $PID_BUDGET $PID_LIST 2>/dev/null; exit 0" INT TERM
    wait $PID_DASHBOARD $PID_BUDGET $PID_LIST
else
    if [[ "$ENV" == "prod" ]]; then
        echo "🚀 Starting $APP in prod mode (proxy: budgetapp-ma3x.onrender.com)..."
    else
        echo "🚀 Starting $APP in local mode (proxy: localhost:3000)..."
    fi
    run_app "$APP" "$ENV"
fi
