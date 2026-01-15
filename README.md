# Aquarium Timelapse System

Automated timelapse capture system for Raspberry Pi Zero 2 W with Google Drive sync.

## System Overview

- **Captures**: Images every 5 minutes (configurable)
- **Storage**: Local images organized by date, synced to Google Drive every 6 hours
- **Cleanup**: Automatically removes local images older than 7 days (after sync verification)
- **Auto-start**: Runs automatically on boot via systemd

## Directory Structure
```
/home/saainithil97/projects/timelapse/
├── config.json              # Configuration file
├── capture.py               # Main capture script
├── sync_to_drive.sh        # Google Drive sync script
├── cleanup.sh              # Local cleanup script
├── images/                 # Captured images (organized by date)
│   ├── 2026-01-15/
│   │   ├── 20260115_120000.jpg
│   │   └── ...
│   └── 2026-01-16/
├── logs/
│   ├── timelapse.log      # Capture logs
│   ├── sync.log           # Sync logs
│   └── cleanup.log        # Cleanup logs
└── README.md              # This file
```

## Configuration

Edit settings in `config.json`:
```json
{
  "capture_interval_seconds": 300,    // Capture every 5 minutes (300s)
  "lights_only_mode": false,          // Capture 24/7 or only when lights on
  "light_threshold": 20,              // Brightness threshold for light detection
  "keep_days": 30,                    // Days to keep in metadata (not used for cleanup)
  "image_quality": 90,                // JPEG quality (1-100)
  "resolution": {
    "width": 3280,
    "height": 2464
  }
}
```

**After changing config:**
```bash
sudo systemctl restart timelapse
```

## Service Management

### Capture Service
```bash
# Start/stop capture
sudo systemctl start timelapse
sudo systemctl stop timelapse
sudo systemctl restart timelapse

# Check status
sudo systemctl status timelapse

# Enable/disable auto-start on boot
sudo systemctl enable timelapse
sudo systemctl disable timelapse

# View real-time logs
sudo journalctl -u timelapse -f
tail -f logs/timelapse.log
```

### Sync Service (runs every 6 hours)
```bash
# Trigger sync manually
sudo systemctl start timelapse-sync.service

# Check timer status
sudo systemctl status timelapse-sync.timer
systemctl list-timers | grep timelapse

# View sync logs
tail -f logs/sync.log
```

### Cleanup Service (runs daily at 3am)
```bash
# Run cleanup manually
./cleanup.sh

# Check timer status
sudo systemctl status timelapse-cleanup.timer

# View cleanup logs
cat logs/cleanup.log
```

## Useful Commands

### Monitoring & Debugging
```bash
# Check all timelapse services at once
systemctl status timelapse timelapse-sync.timer timelapse-cleanup.timer

# View all logs together
tail -f logs/*.log

# Check disk usage
du -sh images/
df -h

# Count total images
find images/ -name "*.jpg" | wc -l

# See latest captured image
ls -lt images/$(date +%Y-%m-%d)/ | head -5

# Check Google Drive sync status
rclone ls aquarium_drive:AquariumTimelapse | wc -l
```

### Manual Operations
```bash
# Test camera capture
python3 -c "from picamera2 import Picamera2; p = Picamera2(); p.start(); p.capture_file('test.jpg'); p.stop()"

# Manual sync to Google Drive
./sync_to_drive.sh

# Manual cleanup
./cleanup.sh

# View specific date folder
ls -lh images/2026-01-15/

# Check image file size
ls -lh images/2026-01-15/*.jpg | head
```

### Troubleshooting

**Camera not working:**
```bash
# Check camera is detected
libcamera-hello --list-cameras

# Test picamera2
python3 -c "from picamera2 import Picamera2; print('OK')"

# Check capture service logs
sudo journalctl -u timelapse -n 50
```

**Service won't start:**
```bash
# Check for errors
sudo systemctl status timelapse
sudo journalctl -u timelapse -n 100 --no-pager

# Verify Python script syntax
python3 -m py_compile capture.py

# Check file permissions
ls -la capture.py
```

**No images being captured:**
```bash
# Check service is running
sudo systemctl status timelapse

# View logs in real-time
tail -f logs/timelapse.log

# Verify config file is valid
cat config.json | python3 -m json.tool
```

**Google Drive sync not working:**
```bash
# Test rclone connection
rclone ls aquarium_drive:AquariumTimelapse

# Check sync logs
tail -50 logs/sync.log

# Manual sync with verbose output
rclone copy images/ aquarium_drive:AquariumTimelapse -v
```

**Cleanup deleting too much/too little:**
```bash
# Check cleanup settings
grep DAYS_TO_KEEP cleanup.sh

# See what would be deleted (edit script, add 'echo' before 'rm')
vi cleanup.sh  # Add 'echo' before 'rm -rf "$date_dir"'
./cleanup.sh

# View cleanup history
cat logs/cleanup.log
```

**Disk space issues:**
```bash
# Check disk usage
df -h
du -sh images/
du -sh images/*/ | sort -h

# Find largest directories
du -sh images/*/ | sort -rh | head -10

# Emergency cleanup (delete oldest date folders manually)
rm -rf images/2026-01-01
rm -rf images/2026-01-02
```

### Performance Monitoring
```bash
# CPU and memory usage
htop

# Temperature (important for Pi Zero 2 W)
vcgencmd measure_temp

# Network usage
ifconfig

# Check systemd timers
systemctl list-timers --all
```

## Storage Information

**Image sizes:**
- Each image: ~3-5 MB
- At 5-minute intervals: ~288 images/day = ~1 GB/day
- At 30-minute intervals: ~48 images/day = ~150 MB/day

**32GB SD Card capacity:**
- At 5 min: ~30 days
- At 30 min: ~200+ days

**Cleanup keeps 7 days locally**, rest is on Google Drive.

## Common Configuration Changes

### Change capture interval to 30 minutes
```bash
vi config.json
# Change: "capture_interval_seconds": 1800
sudo systemctl restart timelapse
```

### Enable lights-only mode
```bash
vi config.json
# Change: "lights_only_mode": true
sudo systemctl restart timelapse
```

### Change sync frequency
```bash
sudo vi /etc/systemd/system/timelapse-sync.timer
# Change OnCalendar line:
# Every 3 hours: OnCalendar=*-*-* */3:00:00
# Every hour: OnCalendar=hourly
# Daily at 2am: OnCalendar=daily 02:00:00

sudo systemctl daemon-reload
sudo systemctl restart timelapse-sync.timer
```

### Change cleanup retention period
```bash
vi cleanup.sh
# Change: DAYS_TO_KEEP=14  (keep 14 days instead of 7)
```

## Video Compilation (on PC/Laptop)

Download images from Google Drive and use ffmpeg:
```bash
# On your PC (not Pi):
# Install rclone and configure same remote

# Download specific date
rclone copy aquarium_drive:AquariumTimelapse/2026-01-15 ./timelapse_images/

# Create video with ffmpeg
ffmpeg -framerate 30 -pattern_type glob -i '*.jpg' \
  -c:v libx264 -pix_fmt yuv420p -crf 23 \
  timelapse_$(date +%Y%m%d).mp4
```

## Backup & Recovery

**Backup configuration:**
```bash
tar -czf timelapse_backup.tar.gz config.json *.sh *.py
```

**Restore from Google Drive:**
```bash
rclone copy aquarium_drive:AquariumTimelapse images/ --progress
```

## System Resources

**Expected usage:**
- CPU: <5% idle, <50% during capture
- RAM: ~100-200 MB
- Network: Bursts during sync, otherwise idle
- Disk I/O: Low, bursts during capture

## Security Notes

- Rclone config contains OAuth token: `~/.config/rclone/rclone.conf`
- Services run as user `saainithil97` (not root)
- No incoming network connections required
- Consider enabling UFW firewall for SSH protection

## Support & Modifications

**Files you can safely edit:**
- `config.json` - All settings
- `cleanup.sh` - Cleanup behavior
- `sync_to_drive.sh` - Sync behavior

**Files requiring restart after editing:**
- `capture.py` - Requires: `sudo systemctl restart timelapse`

**Systemd files:**
- `/etc/systemd/system/timelapse.service`
- `/etc/systemd/system/timelapse-sync.{service,timer}`
- `/etc/systemd/system/timelapse-cleanup.{service,timer}`

After editing systemd files: `sudo systemctl daemon-reload`

## Quick Reference
```bash
# View everything at once
watch -n 5 '
  echo "=== Service Status ==="
  systemctl is-active timelapse timelapse-sync.timer timelapse-cleanup.timer
  echo ""
  echo "=== Disk Usage ==="
  du -sh /home/saainithil97/projects/timelapse/images
  echo ""
  echo "=== Image Count ==="
  find /home/saainithil97/projects/timelapse/images -name "*.jpg" | wc -l
  echo ""
  echo "=== Temperature ==="
  vcgencmd measure_temp
'
```

---

## Troubleshooting Checklist

If things aren't working:

1. ✓ Is the service running? `systemctl status timelapse`
2. ✓ Are images being created? `ls images/$(date +%Y-%m-%d)/`
3. ✓ Check the logs: `tail -f logs/timelapse.log`
4. ✓ Is Google Drive syncing? `tail -f logs/sync.log`
5. ✓ Disk space OK? `df -h`
6. ✓ Config file valid? `cat config.json | python3 -m json.tool`

## Contact

For issues or questions, check:
- Capture logs: `logs/timelapse.log`
- System logs: `sudo journalctl -u timelapse`
- Sync logs: `logs/sync.log`
