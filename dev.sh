#!/bin/bash

# Define ports to clear
PORTS=(3000 4200 4201 4202 27017)

# Determine which environment to use
ENV="${1:-local}"  # Default to 'local' if not specified

if [[ "$ENV" != "local" && "$ENV" != "prod" ]]; then
    echo "❌ Invalid environment: $ENV"
    echo "Usage: ./dev.sh [local|prod]"
    echo "  local - Uses localhost:3000 backend (default)"
    echo "  prod  - Uses https://budgetapp-ma3x.onrender.com backend"
    exit 1
fi

echo "🔧 Environment: $ENV"

echo "🧹 Forcefully stopping containers..."
# Force remove the specific containers for this project
docker rm -f budget-app_frontend-dashboard_1 budget-app_frontend-budget_1 budget-app_frontend-list_1 budget-app_backend_1 budget-app_mongo_1 2>/dev/null || true

# Also run standard down to clean up networks
docker-compose down --remove-orphans 2>/dev/null || true

echo "🔍 Checking for local (non-Docker) processes holding ports..."
for PORT in "${PORTS[@]}"; do
    PIDS=$(lsof -ti :$PORT 2>/dev/null)
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            # Get process name, handle potential errors if process vanished
            PNAME=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
            
            # Trim whitespace
            PNAME=$(echo "$PNAME" | xargs)

            # Only kill if it is NOT a Docker process
            if [[ "$PNAME" != *"docker"* && "$PNAME" != *"com.docker"* ]]; then
                echo "   🚫 Killing local process '$PNAME' ($PID) on port $PORT..."
                kill -9 "$PID" 2>/dev/null || true
            else
                echo "   ℹ️  Port $PORT is held by '$PNAME' (PID $PID). Attempting to proceed (Docker should re-bind it)..."
            fi
        done
    fi
done

# Export environment variable for docker-compose
export FRONTEND_ENV=$ENV

echo "🚀 Starting application with $ENV environment..."
docker-compose up --build
