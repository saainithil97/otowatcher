#!/bin/bash
set -e

# Configuration
PI_HOST="${PI_HOST:-pi@otowatcher}"
PI_PATH="${PI_PATH:-/home/saainithil97/projects/timelapse/static}"
SERVICE_NAME="timelapse-viewer"

echo "🚀 Deploying Aquarium Timelapse UI to Raspberry Pi..."

# Build the React app
echo "📦 Building React app..."
npm run build

# Deploy to Pi
echo "🔄 Deploying to $PI_HOST:$PI_PATH..."
rsync -avz --delete dist/ "$PI_HOST:$PI_PATH/"

# Restart Flask service
echo "🔄 Restarting Flask service..."
ssh "$PI_HOST" "systemctl --user restart $SERVICE_NAME"

echo "✅ Deployment complete!"
echo "   Visit http://otowatcher:5000"
