# Aquarium Timelapse System

Automated timelapse capture system for Raspberry Pi Zero 2 W with Camera Module v3, featuring React web UI and Google Drive sync.

## Features

- **Camera Module v3 Optimized**: Full support for IMX708 sensor with autofocus, HDR, and advanced noise reduction
- **Modern Web UI**: React + TypeScript SPA with real-time monitoring, gallery, and settings management
- **Automated Capture**: Images at configurable intervals with lights-only mode and time window support
- **Cloud Sync**: Automatic Google Drive backup every 6 hours
- **Smart Cleanup**: Removes local images older than configurable days (after sync verification)
- **Modular Backend**: Clean Flask architecture with separated concerns and service layers
- **Auto-start**: Runs automatically on boot via systemd services

## Architecture

### Backend (Python + Flask)
```
app.py                      # Main entry point (new modular architecture)
capture.py                  # Automated capture service
camera_config.py            # Shared Camera Module v3 configuration
config_constants.py         # Centralized constants and paths

api/
├── __init__.py            # Flask application factory
├── routes/                # API endpoints (blueprints)
│   ├── images.py         # Image serving, gallery, stats
│   ├── camera.py         # Stream, capture, video feed
│   ├── services.py       # Service control (start/stop/restart)
│   ├── config.py         # Configuration management
│   ├── calendar.py       # Calendar-based filtering
│   └── comparison.py     # Image comparison
└── services/              # Business logic layer
    ├── image_service.py  # Image operations
    ├── systemd_service.py # Service management
    └── camera_service.py # Camera operations
```

### Frontend (React + TypeScript)
```
frontend/
├── src/
│   ├── views/
│   │   ├── LiveView.tsx      # Live capture/stream + stats
│   │   ├── GalleryView.tsx   # Image grid + calendar filter + comparison
│   │   └── SettingsView.tsx  # Config form + service control
│   ├── components/
│   │   └── Dock.tsx          # Bottom navigation
│   ├── api/
│   │   └── client.ts         # API client with TanStack Query
│   └── types/
│       └── index.ts          # TypeScript type definitions
└── deploy.sh                 # Build and deploy to Pi
```

## Directory Structure
```
/home/saainithil97/projects/timelapse/
├── app.py                   # Main Flask app (use this)
├── capture.py               # Capture service
├── camera_config.py         # Shared camera configuration
├── config_constants.py      # Configuration constants
├── config.json              # Main configuration file
├── api/                     # Modular Flask API
├── static/                  # React build (deployed by frontend/deploy.sh)
│   ├── index.html
│   └── assets/
├── images/                  # Captured images (organized by date)
│   ├── 2026-01-15/
│   │   ├── 20260115_120000.jpg
│   │   └── ...
│   └── 2026-01-16/
├── logs/
│   ├── timelapse.log       # Capture logs
│   ├── sync.log            # Sync logs
│   └── cleanup.log         # Cleanup logs
└── services/
    ├── timelapse.service           # Capture service
    ├── timelapse-viewer.service    # Web UI service
    ├── timelapse-sync.{service,timer}
    └── timelapse-cleanup.{service,timer}
```

## Configuration

Edit settings in `config.json`:
```json
{
  "camera_settings": {
    "sharpness": 1.8,              // Enhanced for Camera Module v3
    "contrast": 1.15,
    "saturation": 1.05,
    "exposure_compensation": -0.3,
    "noise_reduction_mode": "HighQuality",  // HighQuality|Fast|Minimal
    "metering_mode": "CentreWeighted",      // CentreWeighted|Spot|Matrix
    "hdr_mode": false,             // Enable HDR (Camera v3 feature)
    "awb_mode": "auto",            // Auto white balance
    "frame_duration_limits": {     // LED flicker handling
      "min_us": 100,
      "max_us": 120000
    }
  },
  "capture_interval_seconds": 60,  // Capture every minute
  "capture_window": {              // Time window restriction
    "enabled": false,
    "start_time": "10:00",
    "end_time": "16:00"
  },
  "lights_only_mode": false,       // Capture only when lights detected
  "light_threshold": 20,           // Brightness threshold
  "keep_days": 7,                  // Days to keep locally
  "image_quality": 100,            // JPEG quality (1-100)
  "resolution": {
    "width": 2560,
    "height": 1440
  }
}
```

**After changing config:**
```bash
systemctl --user restart timelapse
# Web UI service will auto-reload on next request
```

## Web UI

Access the web interface at: `http://otowatcher:5000` or `http://<pi-ip>:5000`

**Features:**
- **Live View**: Real-time capture button, live stream, and stats dashboard
- **Gallery**: Image grid with calendar filtering and comparison tools (side-by-side or slider)
- **Settings**: Configuration form and service control (start/stop/restart)

**Navigation:**
- Bottom dock with 3 sections: Live, Gallery, Settings
- Responsive design works on mobile and desktop

## Service Management

### Web UI Service (Flask + React)
```bash
# Start/stop web interface
systemctl --user start timelapse-viewer
systemctl --user stop timelapse-viewer
systemctl --user restart timelapse-viewer

# Check status
systemctl --user status timelapse-viewer

# View logs
journalctl --user -u timelapse-viewer -f
```

### Capture Service
```bash
# Start/stop capture
systemctl --user start timelapse
systemctl --user stop timelapse      # Now stops within 1-2 seconds
systemctl --user restart timelapse

# Check status
systemctl --user status timelapse

# Enable/disable auto-start on boot
systemctl --user enable timelapse
systemctl --user disable timelapse

# View real-time logs
journalctl --user -u timelapse -f
tail -f logs/timelapse.log
```

### Sync Service (runs every 6 hours)
```bash
# Trigger sync manually
systemctl --user start timelapse-sync.service

# Check timer status
systemctl --user status timelapse-sync.timer
systemctl --user list-timers | grep timelapse

# View sync logs
tail -f logs/sync.log
```

### Cleanup Service (runs daily at 3am)
```bash
# Run cleanup manually
./cleanup.sh

# Check timer status
systemctl --user status timelapse-cleanup.timer

# View cleanup logs
cat logs/cleanup.log
```

## API Endpoints

All endpoints return JSON responses.

### Images
- `GET /latest.jpg` - Latest captured image (JPEG)
- `GET /image/<path>` - Specific image by path
- `GET /api/stats` - Image statistics (total, today, disk usage, latest time)
- `GET /api/gallery?count=20` - Recent images with metadata

### Camera
- `POST /api/capture` - Capture image immediately
- `POST /api/stream/start` - Start live stream
- `POST /api/stream/stop` - Stop live stream
- `GET /api/stream/status` - Stream status (active/inactive)
- `GET /video_feed` - MJPEG stream endpoint

### Services
- `GET /api/service/status` - Status of all systemd services
- `POST /api/service/start` - Start service (body: `{"service": "capture"}`)
- `POST /api/service/stop` - Stop service
- `POST /api/service/restart` - Restart service

### Configuration
- `GET /api/config` - Get current configuration
- `POST /api/config` - Update configuration (validates JSON schema)

### Calendar
- `GET /api/calendar/days?year=2024&month=1` - Days with images
- `GET /api/calendar/images?date=2024-01-15` - All images for date

### Comparison
- `GET /api/compare/quick?days_ago=7` - Quick comparison (latest vs N days ago)

## Camera Module v3 Features

The system is fully optimized for the Camera Module v3 (IMX708 sensor):

**Autofocus:**
- Continuous autofocus mode with fast speed
- Ideal for aquarium with moving subjects
- Automatically enabled on capture and stream

**Noise Reduction:**
- Three modes: HighQuality, Fast, Minimal
- Leverages IMX708's improved low-light performance
- Configurable in settings

**HDR Mode:**
- Enable for high contrast scenes
- Properly implemented at configuration time
- Toggle in web UI settings

**Matrix Metering:**
- Better exposure for varied lighting
- Alternative: CentreWeighted or Spot metering

**Frame Duration Limits:**
- Handles LED flicker from aquarium lighting
- Configurable min/max microseconds
- Default: 100-120000μs

## Deployment

### Initial Setup on Raspberry Pi
```bash
# Install dependencies
sudo apt-get update
sudo apt-get install python3-pip python3-picamera2 gunicorn

# Install Python packages
pip3 install flask flask-cors

# Clone/copy project to Pi
cd /home/saainithil97/projects/timelapse

# Install systemd services
cp services/*.service services/*.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable timelapse timelapse-viewer
systemctl --user enable timelapse-sync.timer timelapse-cleanup.timer
systemctl --user start timelapse timelapse-viewer
```

### Frontend Development & Deployment
```bash
# On development machine (in frontend/ directory)
npm install
npm run dev        # Development mode on localhost:5173

# Build and deploy to Pi
./deploy.sh        # Builds and rsync to Pi's /static directory
```

The deploy script:
1. Builds React app (`npm run build`)
2. Deploys to Pi's `static/` directory via rsync
3. Restarts Flask service

### Running the Web UI
```bash
# Development (on Pi)
python3 app.py

# Production (recommended)
gunicorn -b 0.0.0.0:5000 app:app

# Or use systemd service
systemctl --user start timelapse-viewer
```

## Useful Commands

### Monitoring & Debugging
```bash
# Check all services at once
systemctl --user status timelapse timelapse-viewer timelapse-sync.timer

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

### Camera Testing
```bash
# Test Camera Module v3 detection
libcamera-hello --list-cameras

# Test picamera2
python3 -c "from picamera2 import Picamera2; print('Camera OK')"

# Test autofocus
python3 -c "from picamera2 import Picamera2; from libcamera import controls; p = Picamera2(); p.start(); p.set_controls({'AfMode': controls.AfModeEnum.Continuous}); print('Autofocus OK')"

# Manual capture with Camera v3 settings
python3 -c "from camera_config import CameraConfig, load_camera_config; from picamera2 import Picamera2; p = Picamera2(); config = load_camera_config(); CameraConfig.initialize_camera_for_capture(p, config); p.capture_file('test.jpg'); p.stop()"
```

### API Testing
```bash
# Test API endpoints
curl http://localhost:5000/api/stats
curl http://localhost:5000/api/gallery?count=5
curl http://localhost:5000/api/service/status

# Capture image via API
curl -X POST http://localhost:5000/api/capture

# Start/stop stream
curl -X POST http://localhost:5000/api/stream/start
curl -X POST http://localhost:5000/api/stream/stop
```

## Troubleshooting

**Service takes 30+ seconds to stop:**
- Fixed! Now stops within 1-2 seconds
- Uses interruptible sleep loop checking shutdown flag every second

**Camera not working:**
```bash
# Check camera is detected
libcamera-hello --list-cameras

# Check capture service logs
journalctl --user -u timelapse -n 50

# Verify Camera Module v3 features
python3 -c "from libcamera import controls; print(dir(controls.AfModeEnum))"
```

**Web UI not loading:**
```bash
# Check viewer service
systemctl --user status timelapse-viewer

# Verify static files exist
ls -la static/

# Rebuild and redeploy
cd frontend && ./deploy.sh
```

**No images being captured:**
```bash
# Check service is running
systemctl --user status timelapse

# View logs in real-time
tail -f logs/timelapse.log

# Check capture window settings
grep capture_window config.json

# Verify config file is valid
python3 -m json.tool < config.json
```

**API timeout errors:**
- Timeout increased to 30 seconds for service control
- Should handle graceful shutdowns properly

## Storage Information

**Image sizes:**
- Each image: ~3-8 MB (depending on quality and resolution)
- At 1-minute intervals: ~1440 images/day = ~5-10 GB/day
- At 5-minute intervals: ~288 images/day = ~1-2 GB/day

**32GB SD Card capacity:**
- At 1 min: ~3-6 days
- At 5 min: ~15-30 days
- With 7-day cleanup: Sustainable indefinitely

**Cleanup keeps 7 days locally**, rest is on Google Drive.

## Performance

**Resource Usage:**
- CPU: <5% idle, <30% during capture (Camera v3 is efficient)
- RAM: ~150-250 MB
- Network: Bursts during sync, otherwise idle
- Temperature: Monitor with `vcgencmd measure_temp`

**Optimizations:**
- Camera Module v3 autofocus reduces capture time
- Modular backend reduces memory footprint
- React SPA provides fast, responsive UI
- Service shutdown optimized (1-2 seconds vs 30+)

## Recent Changes

See `REFACTORING.md` for detailed documentation of the backend refactoring.

**Major Updates:**
- Migrated to modular Flask architecture with blueprints
- Created shared `camera_config.py` for Camera Module v3 settings
- Eliminated ~200 lines of duplicate camera code
- Added React TypeScript frontend with modern UI
- Implemented proper HDR mode support
- Fixed service shutdown timeout issues
- Added capture window (time restriction) support
- Removed deprecated `viewer.py` and template files

## Security Notes

- Rclone config contains OAuth token: `~/.config/rclone/rclone.conf`
- Services run as user (not root): `systemctl --user`
- No incoming network connections required (outbound only for Google Drive)
- Web UI accessible on local network only (bind to 0.0.0.0:5000)
- Consider enabling UFW firewall for SSH protection

## Development

**Adding new features:**
1. Backend: Add route to `api/routes/<module>.py` or service to `api/services/`
2. Frontend: Add component/view to `frontend/src/`
3. Build and deploy: `cd frontend && npm run build && ./deploy.sh`
4. Restart services: `systemctl --user restart timelapse-viewer`

**Testing locally:**
```bash
# Backend
python3 app.py

# Frontend (development server with hot reload)
cd frontend && npm run dev
```

## Support

For issues or questions, check:
- Web UI logs: `journalctl --user -u timelapse-viewer -f`
- Capture logs: `logs/timelapse.log` or `journalctl --user -u timelapse`
- Sync logs: `logs/sync.log`
- Frontend errors: Browser console (F12)

For detailed refactoring documentation, see `REFACTORING.md`.
