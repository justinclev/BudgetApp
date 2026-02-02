#!/bin/bash

# Simple script to run frontend in development with different environments
# Usage: ./frontend-dev.sh [local|prod]

ENV="${1:-local}"

if [[ "$ENV" != "local" && "$ENV" != "prod" ]]; then
    echo "❌ Invalid environment: $ENV"
    echo "Usage: ./frontend-dev.sh [local|prod]"
    echo "  local - Uses localhost:3000 backend (default)"
    echo "  prod  - Uses https://budgetapp-ma3x.onrender.com backend"
    exit 1
fi

cd frontend

if [[ "$ENV" == "prod" ]]; then
    echo "🚀 Starting frontend in prod mode (proxy: budgetapp-ma3x.onrender.com)..."
    ng serve --configuration=prod-proxy
else
    echo "🚀 Starting frontend in local mode (proxy: localhost:3000)..."
    ng serve
fi
