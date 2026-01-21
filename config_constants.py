#!/usr/bin/env python3
"""
Configuration Constants
Centralized constants for service names, paths, and configuration
"""

from pathlib import Path
import platform


class ServiceConfig:
    """Systemd service configuration"""

    # Service file names
    CAPTURE_SERVICE = 'timelapse.service'
    SYNC_TIMER = 'timelapse-sync.timer'
    SYNC_SERVICE = 'timelapse-sync.service'
    CLEANUP_TIMER = 'timelapse-cleanup.timer'
    CLEANUP_SERVICE = 'timelapse-cleanup.service'
    VIEWER_SERVICE = 'timelapse-viewer.service'

    # Display names for UI
    DISPLAY_NAMES = {
        'capture': 'Image Capture Service',
        'sync_timer': 'Google Drive Sync Timer',
        'cleanup_timer': 'Image Cleanup Timer'
    }

    # Service key mapping (for API compatibility)
    SERVICE_MAP = {
        'capture': CAPTURE_SERVICE,
        'sync_timer': SYNC_TIMER,
        'cleanup_timer': CLEANUP_TIMER,
        # Backward compatibility: accept full service names
        CAPTURE_SERVICE: CAPTURE_SERVICE,
        SYNC_TIMER: SYNC_TIMER,
        CLEANUP_TIMER: CLEANUP_TIMER
    }

    @classmethod
    def get_service_name(cls, key: str) -> str:
        """Get systemd service name from key"""
        return cls.SERVICE_MAP.get(key, cls.CAPTURE_SERVICE)

    @classmethod
    def get_display_name(cls, key: str) -> str:
        """Get display name for UI"""
        return cls.DISPLAY_NAMES.get(key, key.replace('_', ' ').title())


class PathConfig:
    """File path configuration"""

    # Base directory (script location)
    BASE_DIR = Path(__file__).parent

    # Images directory
    if platform.system() == 'Darwin':  # macOS
        IMAGES_DIR = BASE_DIR / "test_images"
    else:
        IMAGES_DIR = BASE_DIR / "images"

    # Configuration files
    CONFIG_PATH = BASE_DIR / "config.json"
    SCHEMA_PATH = BASE_DIR / "config_schema.json"

    # Log directory and files
    LOG_DIR = BASE_DIR / "logs"
    TIMELAPSE_LOG = LOG_DIR / "timelapse.log"
    SYNC_LOG = LOG_DIR / "sync.log"
    CLEANUP_LOG = LOG_DIR / "cleanup.log"
    VIEWER_LOG = LOG_DIR / "viewer.log"

    # Log file mapping
    LOG_FILES = {
        'timelapse': TIMELAPSE_LOG,
        'sync': SYNC_LOG,
        'cleanup': CLEANUP_LOG,
        'viewer': VIEWER_LOG
    }

    @classmethod
    def get_log_path(cls, log_type: str) -> Path:
        """Get log file path by type"""
        return cls.LOG_FILES.get(log_type, cls.TIMELAPSE_LOG)

    @classmethod
    def ensure_directories(cls):
        """Ensure all required directories exist"""
        cls.IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        cls.LOG_DIR.mkdir(parents=True, exist_ok=True)


class CameraDefaults:
    """Default camera settings for Camera Module v3"""

    # Default resolution
    DEFAULT_WIDTH = 3280
    DEFAULT_HEIGHT = 2464

    # Stream resolution (lower for bandwidth)
    STREAM_WIDTH = 1280
    STREAM_HEIGHT = 960

    # Default rotation
    DEFAULT_ROTATION = 270  # 90 degrees clockwise

    # Warm-up times
    CAPTURE_WARMUP_SECONDS = 2
    STREAM_WARMUP_SECONDS = 1

    # Camera Module v3 optimized defaults
    DEFAULT_SETTINGS = {
        'sharpness': 1.8,
        'contrast': 1.15,
        'saturation': 1.05,
        'exposure_compensation': -0.3,
        'noise_reduction_mode': 'HighQuality',
        'metering_mode': 'CentreWeighted',
        'hdr_mode': False,
        'awb_mode': 'auto',
        'awb_gains_red': 1.5,
        'awb_gains_blue': 1.8,
        'frame_duration_limits': {
            'min_us': 100,
            'max_us': 120000
        }
    }


class APIDefaults:
    """Default values for API endpoints"""

    # Gallery pagination
    DEFAULT_GALLERY_COUNT = 20

    # Log lines to return
    DEFAULT_LOG_LINES = 50

    # Disk usage warning threshold (percentage)
    DISK_WARNING_THRESHOLD = 80

    # Systemctl command timeout (seconds)
    SYSTEMCTL_TIMEOUT = 5

    # Stream frame rate
    STREAM_FPS = 10
    STREAM_INTERVAL = 1.0 / STREAM_FPS  # 0.1 seconds


class ErrorMessages:
    """Standardized error messages"""

    # Camera errors
    CAMERA_NOT_AVAILABLE = "Camera not available on this system"
    CAMERA_IN_USE = "The camera is busy. Make sure the capture service is stopped."
    CAMERA_NOT_DETECTED = "Camera hardware not detected. Check camera connection."
    CAMERA_PERMISSION_DENIED = "Permission denied. Check camera permissions."

    # Service errors
    SERVICE_ALREADY_ACTIVE = "Service is already active"
    SERVICE_NOT_ACTIVE = "Service is not active"
    CAPTURE_SERVICE_RUNNING = "Capture service is running. Stop it first to use the camera."

    # Stream errors
    STREAM_ALREADY_ACTIVE = "Stream already active"
    STREAM_NOT_ACTIVE = "Stream not active. Start it first."

    # Config errors
    CONFIG_VALIDATION_FAILED = "Configuration validation failed"
    CONFIG_MISSING_FIELD = "Missing required configuration field"

    # Suggestions
    SUGGESTION_STOP_CAPTURE = "Go to Services tab and click 'Stop' on Capture Service"
    SUGGESTION_CHECK_CAMERA = "Check camera connection and ensure it's properly connected"
    SUGGESTION_CHECK_PERMISSIONS = "Ensure the user has permission to access the camera"


# Export all for convenience
__all__ = [
    'ServiceConfig',
    'PathConfig',
    'CameraDefaults',
    'APIDefaults',
    'ErrorMessages'
]
