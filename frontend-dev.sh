#!/bin/bash

# Script to run frontend apps in development
# Usage: ./frontend-dev.sh [dashboard|budget] [local|prod]

APP="${1:-dashboard}"
ENV="${2:-local}"

# Validate app
if [[ "$APP" != "dashboard" && "$APP" != "budget" ]]; then
    echo "❌ Invalid app: $APP"
    echo "Usage: ./frontend-dev.sh [dashboard|budget] [local|prod]"
    echo ""
    echo "Apps:"
    echo "  dashboard - Main app dashboard (default)"
    echo "  budget    - Budget app"
    echo ""
    echo "Environments:"
    echo "  local - Uses localhost:3000 backend (default)"
    echo "  prod  - Uses https://budgetapp-ma3x.onrender.com backend"
    exit 1
fi

# Validate environment (only relevant for budget app)
if [[ "$ENV" != "local" && "$ENV" != "prod" ]]; then
    echo "❌ Invalid environment: $ENV"
    echo "Usage: ./frontend-dev.sh [dashboard|budget] [local|prod]"
    exit 1
fi

cd "apps/$APP"

if [[ "$APP" == "budget" ]]; then
    if [[ "$ENV" == "prod" ]]; then
        echo "🚀 Starting Budget app in prod mode (proxy: budgetapp-ma3x.onrender.com)..."
        ng serve --configuration=prod-proxy
    else
        echo "🚀 Starting Budget app in local mode (proxy: localhost:3000)..."
        ng serve
    fi
else
    echo "🚀 Starting Dashboard..."
    ng serve
fi
