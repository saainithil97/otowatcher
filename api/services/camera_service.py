"""
Camera Service
Handles camera streaming and capture operations
"""

import io
import time
import threading
from typing import Optional, Dict
from datetime import datetime
from pathlib import Path

from camera_config import CameraConfig
from config_constants import ErrorMessages, APIDefaults

try:
    from picamera2 import Picamera2
    HAS_CAMERA = True
except ImportError:
    try:
        from mock_camera import MockPicamera2 as Picamera2
        HAS_CAMERA = True
        print("Using mock camera for testing")
    except ImportError:
        HAS_CAMERA = False
        Picamera2 = None


class StreamManager:
    """Manages camera streaming with proper locking"""

    def __init__(self):
        self._camera: Optional[Picamera2] = None
        self._active = False
        self._lock = threading.Lock()

    @property
    def is_active(self) -> bool:
        return self._active

    @property
    def camera(self) -> Optional[Picamera2]:
        return self._camera

    def start(self, config_path: str) -> Dict:
        """Start camera stream"""
        if not HAS_CAMERA:
            return {
                "success": False,
                "error": ErrorMessages.CAMERA_NOT_AVAILABLE
            }

        with self._lock:
            if self._active:
                return {
                    "success": False,
                    "error": ErrorMessages.STREAM_ALREADY_ACTIVE
                }

            try:
                self._camera = Picamera2()

                # Initialize camera for streaming
                if not CameraConfig.initialize_camera_for_stream(self._camera, config_path):
                    self._cleanup_camera()
                    return {
                        "success": False,
                        "error": "Failed to initialize camera for streaming"
                    }

                self._active = True
                return {"success": True, "message": "Stream started"}

            except Exception as e:
                self._cleanup_camera()
                error_msg = str(e)
                suggestion = self._get_error_suggestion(error_msg)

                return {
                    "success": False,
                    "error": error_msg,
                    "suggestion": suggestion
                }

    def stop(self) -> Dict:
        """Stop camera stream"""
        with self._lock:
            if not self._active:
                return {
                    "success": False,
                    "error": ErrorMessages.STREAM_NOT_ACTIVE
                }

            try:
                self._active = False
                self._cleanup_camera()
                return {"success": True, "message": "Stream stopped"}
            except Exception as e:
                return {"success": False, "error": str(e)}

    def generate_frames(self):
        """Generate frames for MJPEG streaming"""
        while self._active:
            try:
                if self._camera is None:
                    break

                # Capture frame as JPEG
                buffer = io.BytesIO()
                self._camera.capture_file(buffer, format='jpeg')
                frame = buffer.getvalue()

                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

                time.sleep(APIDefaults.STREAM_INTERVAL)
            except Exception as e:
                print(f"Error generating frame: {e}")
                break

    def _cleanup_camera(self):
        """Clean up camera resources"""
        if self._camera:
            try:
                self._camera.stop()
                self._camera.close()
            except:
                pass
            self._camera = None

    @staticmethod
    def _get_error_suggestion(error_msg: str) -> str:
        """Get helpful suggestion based on error message"""
        if "did not complete" in error_msg or "Camera is in use" in error_msg:
            return ErrorMessages.SUGGESTION_STOP_CAPTURE
        elif "No such file or directory" in error_msg:
            return ErrorMessages.SUGGESTION_CHECK_CAMERA
        return ""


class CameraService:
    """Service for camera capture operations"""

    @staticmethod
    def capture_now(config: Dict, images_dir: Path) -> Dict:
        """Capture an image immediately"""
        if not HAS_CAMERA:
            return {
                "success": False,
                "error": ErrorMessages.CAMERA_NOT_AVAILABLE
            }

        try:
            # Get timestamp and create directory structure
            now = datetime.now()
            date_str = now.strftime("%Y-%m-%d")
            time_str = now.strftime("%Y%m%d_%H%M%S")

            # Use storage_path from config or fall back to images_dir
            storage_path = Path(config.get('storage_path', images_dir))
            date_dir = storage_path / date_str
            date_dir.mkdir(parents=True, exist_ok=True)

            output_path = date_dir / f"{time_str}.jpg"

            # Initialize camera
            picam2 = Picamera2()

            # Use centralized camera initialization
            if not CameraConfig.initialize_camera_for_capture(picam2, config):
                picam2.close()
                return {
                    "success": False,
                    "error": "Failed to initialize camera for capture"
                }

            # Capture image
            picam2.capture_file(str(output_path))

            # Clean up
            picam2.stop()
            picam2.close()

            # Get file info
            file_size = output_path.stat().st_size / (1024 * 1024)  # MB

            return {
                "success": True,
                "message": "Image captured successfully",
                "path": str(output_path),
                "filename": f"{time_str}.jpg",
                "date_folder": date_str,
                "size_mb": round(file_size, 2),
                "timestamp": now.isoformat()
            }

        except Exception as e:
            # Clean up camera on error
            try:
                if 'picam2' in locals():
                    picam2.stop()
                    picam2.close()
            except:
                pass

            error_msg = str(e)
            suggestion = StreamManager._get_error_suggestion(error_msg)

            return {
                "success": False,
                "error": error_msg,
                "suggestion": suggestion
            }
