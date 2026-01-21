# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aquarium Timelapse System for Raspberry Pi Zero 2 W with Camera Module v3. Captures periodic images, syncs to Google Drive, and provides a modern web interface with React frontend and Flask API backend.

## Development Commands

### Backend (Flask API)
```bash
# Start development server
python3 viewer.py

# Start with Gunicorn (production)
gunicorn --workers 2 --bind 0.0.0.0:5000 --timeout 120 viewer:app

# Test camera capture
python3 -c "from picamera2 import Picamera2; p = Picamera2(); p.start(); p.capture_file('test.jpg'); p.stop()"

# Validate config changes
cat config.json | python3 -m json.tool
```

### Frontend (React + Vite)
```bash
cd frontend

# Install dependencies
npm install

# Development server (proxies API to localhost:5000)
npm run dev

# Build for production
npm run build

# Deploy to Raspberry Pi
./deploy.sh
```

### Service Management
All services run as **user services** (not sudo):
```bash
# Capture service
systemctl --user start timelapse
systemctl --user stop timelapse
systemctl --user restart timelapse
systemctl --user status timelapse

# Web server service
systemctl --user restart timelapse-viewer

# View logs
journalctl --user -u timelapse -f
journalctl --user -u timelapse-viewer -f

# Check timers (sync runs every 6 hours, cleanup daily at 3am)
systemctl --user list-timers
```

### Testing
```bash
# Run capture script manually
python3 capture.py

# Test mock camera (on macOS)
python3 -c "from mock_camera import MockPicamera2; print('Mock OK')"

# Check image count
find images/ -name "*.jpg" | wc -l

# Monitor disk usage
du -sh images/
```

## Architecture Overview

### Backend Structure (Python/Flask)

**viewer.py** (36KB) - Main Flask application with REST API endpoints:
- `/api/stats` - Image statistics
- `/api/gallery` - Recent images list with pagination
- `/api/capture` - Manual capture trigger
- `/api/config` - Configuration management with JSON schema validation
- `/api/service/*` - Service control (start/stop/restart)
- `/api/calendar/*` - Date-based image queries
- `/api/compare/*` - Image comparison endpoints
- `/api/stream/*` - Live MJPEG stream control
- `/image/<path>` - Serve images by path
- `/latest.jpg` - Latest captured image

**capture.py** (11KB) - Continuous capture service:
- Runs in infinite loop with configurable interval
- Camera Module v3 optimized settings
- Light detection with exposure analysis
- Optional time-based capture windows
- Automatic cleanup of images older than `keep_days`
- Graceful shutdown handling (SIGINT/SIGTERM)

**Image Organization:**
```
images/
├── 2026-01-15/              # Date folders (YYYY-MM-DD)
│   ├── 20260115_093000.jpg  # Timestamp format (YYYYMMdd_HHMMSS)
│   └── ...
```

### Frontend Structure (React/TypeScript)

**Component Architecture:**
```
frontend/src/
├── App.tsx              # Main router and QueryClient setup
├── main.tsx            # Entry point
├── views/              # Full-page views
│   └── LatestView.tsx  # Example: stats + image viewer + controls
├── components/         # Reusable components
│   └── Dock.tsx        # Bottom navigation
├── api/
│   └── client.ts       # Typed Axios wrapper for all Flask endpoints
└── types/
    └── index.ts        # TypeScript interfaces for API responses
```

**State Management:**
- TanStack Query (React Query) for server state
- Automatic refetching and caching
- Optimistic updates for mutations

**Development Proxy:** Vite proxies `/api`, `/image`, `/latest.jpg`, `/video_feed` to Flask backend during development.

### Camera System (Picamera2)

**Hardware:** Camera Module v3 (12MP Sony IMX708 sensor)

**Key Settings (capture.py):**
- Transform: 270° rotation (configured as inverse in libcamera)
- Controls: ExposureValue, AwbEnable, ColourGains, AeMeteringMode, Sharpness, Contrast
- Light detection: Analyzes exposure metadata to determine if aquarium lights are on

**Mock Camera:** `mock_camera.py` provides development environment on macOS without hardware.

### Storage & Sync

**Local Storage:** Images kept for 7 days (configurable in config.json)

**Google Drive Sync:**
- Runs every 6 hours via systemd timer
- Uses rclone with parallel transfers (4 workers)
- One-way copy (never deletes from Drive)

**Cleanup:** Daily cleanup verifies images exist on Google Drive before local deletion.

## Configuration Management

**config.json** - All runtime settings with JSON Schema validation:
- `capture_interval_seconds` - Time between captures (60-86400)
- `resolution` - Image dimensions (Camera v3 supports up to 4608x2592)
- `camera_settings` - Exposure, white balance, metering, sharpness, contrast, etc.
- `lights_only_mode` - Only capture when aquarium lights detected
- `capture_window` - Optional time-based restrictions (e.g., 10:00-16:00)
- `keep_days` - Local retention period

**After config changes:** Restart capture service: `systemctl --user restart timelapse`

**Validation:** config_schema.json enforces types, ranges, and enums. Backups created before updates.

## Systemd Services

All services in `services/` directory:
- `timelapse.service` - Runs capture.py continuously
- `timelapse-viewer.service` - Gunicorn WSGI server for Flask app
- `timelapse-sync.service` + `.timer` - Periodic Google Drive sync
- `timelapse-cleanup.service` + `.timer` - Daily cleanup

**Installation:** Run `./services/install_services.sh` to copy and enable all services.

**User Lingering:** Services run even when user logged out (`loginctl enable-linger`).

## API Client Pattern

All API calls should use the typed client in `frontend/src/api/client.ts`:

```typescript
import { apiClient } from '@/api/client';

// Query examples
const stats = await apiClient.getStats();
const images = await apiClient.getGallery(20);
const config = await apiClient.getConfig();

// Mutation examples
await apiClient.captureNow();
await apiClient.saveConfig(newConfig);
await apiClient.controlService('timelapse', 'restart');
```

This ensures type safety and consistent error handling.

## Camera Module v3 Optimization

Camera v3 (IMX708) improvements over v2:
- Higher resolution: 4608x2592 native (vs 3280x2464)
- Better HDR support
- Improved low-light performance
- Faster autofocus

**Recommended settings for aquarium:**
- Resolution: 2560x1440 or 3840x2160 for balance of quality/file size
- Metering: CentreWeighted (focuses on center of tank)
- Sharpness: 1.5-2.0 (higher for aquarium details)
- Contrast: 1.2 (enhance fish visibility)

## React View Implementation Pattern

When creating new views, follow this pattern (see `LatestView.tsx`):

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export default function MyView() {
  // Query for data
  const { data, refetch } = useQuery({
    queryKey: ['myData'],
    queryFn: apiClient.getMyData,
  });

  // Mutation for actions
  const mutation = useMutation({
    mutationFn: apiClient.doAction,
    onSuccess: () => refetch(),
  });

  return (
    <div>
      {/* Use DaisyUI components: card, stats, btn, menu, etc. */}
    </div>
  );
}
```

## Deployment Workflow

1. **Development:** Work on macOS with mock camera, React dev server proxies to Flask
2. **Build:** `npm run build` compiles React to `frontend/dist/`
3. **Deploy:** `frontend/deploy.sh` rsyncs to Pi and restarts service
4. **Verify:** Check `journalctl --user -u timelapse-viewer -f`

## Important Constraints

- **User services only:** Never use `sudo systemctl`, always `systemctl --user`
- **Camera abstraction:** Code detects platform and uses mock camera on Darwin (macOS)
- **Config validation:** All config updates validated against schema before save, with backup/rollback
- **Image paths:** Always use date folder format `YYYY-MM-DD/YYYYMMdd_HHMMSS.jpg`
- **API responses:** Always return `{"success": bool, ...}` format with error field on failure

## Troubleshooting

**Camera not working:**
```bash
libcamera-hello --list-cameras
python3 -c "from picamera2 import Picamera2; print('OK')"
journalctl --user -u timelapse -n 50
```

**Service won't start:**
```bash
systemctl --user status timelapse
journalctl --user -u timelapse -n 100
python3 -m py_compile capture.py
```

**Frontend not loading:**
```bash
# Check Flask is serving static files
curl http://localhost:5000/
# Rebuild frontend
cd frontend && npm run build && ./deploy.sh
```

## Code Style

- **Python:** Follow PEP 8, use descriptive variable names
- **TypeScript:** Strict mode enabled, prefer functional components with hooks
- **DaisyUI:** Use semantic component names (card, btn, stats) over custom CSS
- **API:** RESTful endpoints with consistent JSON responses
