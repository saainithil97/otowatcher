#!/bin/bash

# Aquarium Timelapse Cleanup Script
# Removes local images older than specified days after they've been synced to Google Drive

# Configuration
IMAGES_DIR="/home/saainithil97/projects/timelapse/images"
LOG_FILE="/home/saainithil97/projects/timelapse/logs/cleanup.log"
DAYS_TO_KEEP=7  # Keep images for this many days locally
REMOTE_NAME="aquarium_drive:AquariumTimelapse"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Log function
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_message "==========================================="
log_message "Cleanup started"
log_message "==========================================="

# Check if images directory exists
if [ ! -d "$IMAGES_DIR" ]; then
    log_message "ERROR: Images directory not found: $IMAGES_DIR"
    exit 1
fi

# Find files older than DAYS_TO_KEEP
CUTOFF_DATE=$(date -d "$DAYS_TO_KEEP days ago" +%Y-%m-%d)
log_message "Removing images older than: $CUTOFF_DATE"

# Count files before cleanup
INITIAL_COUNT=$(find "$IMAGES_DIR" -type f -name "*.jpg" | wc -l)
INITIAL_SIZE=$(du -sh "$IMAGES_DIR" | cut -f1)
log_message "Current: $INITIAL_COUNT images, $INITIAL_SIZE total"

# Safety check: Verify files exist on Google Drive before deleting
log_message "Verifying files are synced to Google Drive..."
if ! rclone ls "$REMOTE_NAME" >/dev/null 2>&1; then
    log_message "ERROR: Cannot access Google Drive. Aborting cleanup for safety."
    exit 1
fi

# Delete old images
DELETED_COUNT=0
for date_dir in "$IMAGES_DIR"/*; do
    if [ ! -d "$date_dir" ]; then
        continue
    fi
    
    dir_name=$(basename "$date_dir")
    
    # Check if directory name is a valid date
    if [[ ! "$dir_name" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        continue
    fi
    
    # Compare dates
    if [[ "$dir_name" < "$CUTOFF_DATE" ]]; then
        # Verify this date folder exists on Google Drive
        if rclone lsf "$REMOTE_NAME/$dir_name" >/dev/null 2>&1; then
            # Count files in this directory
            file_count=$(find "$date_dir" -type f -name "*.jpg" | wc -l)
            
            # Delete the directory
            rm -rf "$date_dir"
            DELETED_COUNT=$((DELETED_COUNT + file_count))
            log_message "Deleted: $dir_name ($file_count images)"
        else
            log_message "WARNING: Skipping $dir_name - not found on Google Drive"
        fi
    fi
done

# Count files after cleanup
FINAL_COUNT=$(find "$IMAGES_DIR" -type f -name "*.jpg" 2>/dev/null | wc -l)
FINAL_SIZE=$(du -sh "$IMAGES_DIR" 2>/dev/null | cut -f1)

log_message "-------------------------------------------"
log_message "Cleanup completed"
log_message "Deleted: $DELETED_COUNT images"
log_message "Remaining: $FINAL_COUNT images, $FINAL_SIZE total"
log_message "==========================================="
log_message ""
