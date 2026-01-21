# Backend Refactoring Documentation

## Overview

The backend has been refactored from a monolithic `viewer.py` (1089 lines) into a modular, maintainable architecture. This document explains the changes and how to use the new structure.

## What Changed

### Phase 1: Shared Logic Extraction

#### 1. `camera_config.py` - Camera Configuration Module
**Purpose**: Centralized Camera Module v3 (IMX708) configuration management

**Key Classes**:
- `CameraConfig`: Static methods for camera settings, autofocus, and configuration creation
  - `apply_settings()` - Apply all camera controls
  - `enable_autofocus()` - Enable Camera v3 autofocus
  - `create_still_configuration()` - Still capture config with HDR support
  - `create_video_configuration()` - Video/stream config with HDR support
  - `initialize_camera_for_capture()` - Complete capture initialization
  - `initialize_camera_for_stream()` - Complete stream initialization

**Benefits**:
- Single source of truth for camera settings
- Eliminated ~200 lines of duplicated code
- Easier to update Camera v3 optimizations

#### 2. `config_constants.py` - Configuration Constants
**Purpose**: Centralized constants for services, paths, and configuration

**Key Classes**:
- `ServiceConfig`: Systemd service names and mappings
- `PathConfig`: File paths (images, config, logs)
- `CameraDefaults`: Default camera settings
- `APIDefaults`: API configuration defaults
- `ErrorMessages`: Standardized error messages

**Benefits**:
- No more hardcoded magic strings
- Easier to modify paths and service names
- Consistent error messages across the application

### Phase 2: Modular API Architecture

#### New Structure
```
api/
├── __init__.py                 # Application factory
├── routes/
│   ├── __init__.py
│   ├── images.py               # Image serving, gallery, stats
│   ├── camera.py               # Stream, capture, video feed
│   ├── services.py             # Service control, status
│   ├── config.py               # Config get/update
│   ├── calendar.py             # Calendar days, images
│   └── comparison.py           # Quick compare
└── services/
    ├── __init__.py
    ├── image_service.py        # Image file operations
    ├── systemd_service.py      # Systemctl operations
    └── camera_service.py       # Camera operations

app.py                          # New entry point
capture.py                      # Updated to use camera_config
viewer.py                       # Original (kept for reference)
```

#### Service Layer

**ImageService** (`api/services/image_service.py`)
- Image file operations and metadata
- Methods: `get_latest_image()`, `get_recent_images()`, `get_image_stats()`, etc.

**SystemdService** (`api/services/systemd_service.py`)
- Systemctl operations and service management
- Methods: `get_service_status()`, `control_service()`, `is_service_active()`

**CameraService** (`api/services/camera_service.py`)
- Camera capture operations
- `StreamManager` class for streaming with proper locking
- Methods: `capture_now()`, `start()`, `stop()`, `generate_frames()`

#### Route Blueprints

Each route file is a Flask Blueprint handling specific concerns:

1. **images.py**: `/latest.jpg`, `/image/<path>`, `/api/stats`, `/api/gallery`
2. **camera.py**: `/api/capture`, `/api/stream/*`, `/video_feed`
3. **services.py**: `/api/service/status`, `/api/service/<action>`
4. **config.py**: `/api/config` (GET/POST)
5. **calendar.py**: `/api/calendar/days`, `/api/calendar/images`
6. **comparison.py**: `/api/compare/quick`

## Migration Guide

### Using the New App

#### Option 1: Use new modular app (Recommended)
```bash
# Run the new app
python3 app.py

# Or with Gunicorn
gunicorn -b 0.0.0.0:5000 app:app
```

#### Option 2: Keep using viewer.py (Deprecated)
```bash
# Old way still works
python3 viewer.py
```

### Updating Systemd Service

Update `services/timelapse-viewer.service`:

```ini
[Service]
WorkingDirectory=/home/saainithil97/projects/timelapse
# Old:
# ExecStart=/usr/bin/python3 /home/saainithil97/projects/timelapse/viewer.py
# New:
ExecStart=/usr/bin/gunicorn -b 0.0.0.0:5000 app:app
```

Then reload:
```bash
systemctl --user daemon-reload
systemctl --user restart timelapse-viewer.service
```

### Updating capture.py

The `capture.py` script has been updated to use the shared modules:

**Changes**:
- Imports `camera_config.CameraConfig` instead of local implementation
- Uses `CameraConfig.initialize_camera_for_capture()` for initialization
- Removed ~70 lines of duplicate camera settings code

**No changes needed** - it works automatically with the new modules.

## API Endpoints (Unchanged)

All API endpoints remain **100% backward compatible**:

### Images
- `GET /latest.jpg` - Latest image
- `GET /image/<path>` - Serve specific image
- `GET /api/stats` - Image statistics
- `GET /api/gallery?count=20` - Gallery images

### Camera
- `POST /api/capture` - Capture now
- `POST /api/stream/start` - Start stream
- `POST /api/stream/stop` - Stop stream
- `GET /api/stream/status` - Stream status
- `GET /video_feed` - MJPEG stream

### Services
- `GET /api/service/status` - All services status
- `POST /api/service/<action>` - Control service (start/stop/restart)

### Config
- `GET /api/config` - Get configuration
- `POST /api/config` - Update configuration

### Calendar
- `GET /api/calendar/days?year=2024&month=1` - Days with images
- `GET /api/calendar/images?date=2024-01-15` - Images for date

### Comparison
- `GET /api/compare/quick?days_ago=7` - Quick comparison

## Benefits of New Architecture

### Maintainability
- **Modular**: Each file has a single responsibility
- **DRY**: No code duplication for camera settings
- **Organized**: Clear separation of concerns (routes, services, config)

### Testability
- **Service Layer**: Business logic isolated and testable
- **Blueprints**: Routes can be tested independently
- **Mocking**: Easy to mock services for testing

### Scalability
- **Easy to Add Features**: Add new route files or service classes
- **Clear Patterns**: Established patterns for new endpoints
- **Reusable**: Services can be used by multiple routes

### Code Reduction
- Eliminated ~200 lines of duplicate camera code
- Removed hardcoded strings (replaced with constants)
- Reduced `viewer.py` complexity by extracting concerns

## File Changes Summary

### New Files
- `camera_config.py` - Camera configuration (350 lines)
- `config_constants.py` - Constants (150 lines)
- `app.py` - Entry point (10 lines)
- `api/__init__.py` - App factory (50 lines)
- `api/routes/*.py` - 6 route files (~50 lines each)
- `api/services/*.py` - 3 service files (~100-250 lines each)

### Modified Files
- `capture.py` - Updated to use camera_config (reduced by ~70 lines)

### Unchanged Files
- `viewer.py` - Kept for reference (can be removed later)
- Frontend files - No changes needed
- Service files - No changes needed (just update ExecStart)

## Development Workflow

### Adding a New Endpoint

1. **Determine the concern**: Images, camera, services, config, calendar, or comparison
2. **Add to appropriate route file** (e.g., `api/routes/images.py`)
3. **Use existing services** or add new methods to service classes
4. **Test locally** with `python3 app.py`

Example:
```python
# In api/routes/images.py
@images_bp.route('/api/images/recent/<int:hours>')
def images_last_n_hours(hours):
    """Get images from last N hours"""
    images = image_service.get_images_since(hours)
    return jsonify({'success': True, 'images': images})
```

### Adding a New Service Method

1. **Add method to appropriate service** (e.g., `ImageService`)
2. **Use the method in routes**

Example:
```python
# In api/services/image_service.py
class ImageService:
    def get_images_since(self, hours: int) -> List[Dict]:
        """Get images from last N hours"""
        cutoff = datetime.now() - timedelta(hours=hours)
        # Implementation...
```

## Testing

### Manual Testing Checklist

Test all endpoints to ensure backward compatibility:

```bash
# Stats
curl http://localhost:5000/api/stats

# Gallery
curl http://localhost:5000/api/gallery?count=5

# Latest image
curl http://localhost:5000/latest.jpg --output test.jpg

# Service status
curl http://localhost:5000/api/service/status

# Calendar
curl http://localhost:5000/api/calendar/days?year=2024&month=1

# Config
curl http://localhost:5000/api/config

# Capture (if service stopped)
curl -X POST http://localhost:5000/api/capture

# Stream start
curl -X POST http://localhost:5000/api/stream/start
```

## Rollback Plan

If issues occur:

1. **Revert systemd service**:
   ```bash
   # Edit services/timelapse-viewer.service
   # Change ExecStart back to viewer.py
   systemctl --user daemon-reload
   systemctl --user restart timelapse-viewer.service
   ```

2. **Keep new files** - They don't interfere with viewer.py

3. **Report issues** - Document what broke so it can be fixed

## Future Enhancements

### Possible Phase 3 Improvements
- Add Pydantic models for request validation
- Add proper logging with Flask's logger
- Add error handler decorators
- Add unit tests with pytest
- Add API documentation with Swagger/OpenAPI
- Add rate limiting
- Add authentication/authorization

## Questions?

This refactoring maintains **100% backward compatibility** while improving code organization and maintainability. All existing functionality works exactly as before, just with better structure.
