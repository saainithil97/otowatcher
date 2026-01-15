#!/bin/bash

# Configuration
SOURCE_DIR="/home/saainithil97/projects/timelapse/images"
DEST_DIR="otowatcher:otowatcher"
LOG_FILE="/home/saainithil97/projects/timelapse/logs/sync.log"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Log start
echo "===========================================" >> "$LOG_FILE"
echo "Sync started: $(date)" >> "$LOG_FILE"

# Sync images to Google Drive
# Using 'copy' (not 'sync') - only uploads new files, never deletes
rclone copy "$SOURCE_DIR" "$DEST_DIR" \
    --log-file="$LOG_FILE" \
    --log-level INFO \
    --transfers 4 \
    --checkers 8 \
    --stats 30s

# Log completion
echo "Sync completed: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Optional: Delete local images older than 7 days (uncomment to enable)
# find "$SOURCE_DIR" -type f -name "*.jpg" -mtime +7 -delete
# echo "Cleaned up images older than 7 days" >> "$LOG_FILE"
