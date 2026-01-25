#!/bin/bash

# Define ports to clear
PORTS=(3000 4200 27017)

echo "🧹 Forcefully stopping containers..."
# Force remove the specific containers for this project
docker rm -f budget-app_frontend_1 budget-app_backend_1 budget-app_mongo_1 2>/dev/null || true

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

echo "🚀 Starting application..."
docker-compose up --build
