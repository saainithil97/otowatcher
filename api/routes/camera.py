"""
Camera Routes
Endpoints for camera streaming and capture
"""

from flask import Blueprint, jsonify, request, Response
import json

from api.services import CameraService, StreamManager
from api.services.systemd_service import SystemdService
from config_constants import PathConfig, ErrorMessages

# Create blueprint
camera_bp = Blueprint('camera', __name__)

# Initialize services
stream_manager = StreamManager()


@camera_bp.route('/api/capture', methods=['POST'])
def capture_now():
    """Capture an image immediately using config.json settings"""
    # Check if capture service is running (can't use camera if it is)
    if SystemdService.is_service_active('capture'):
        return jsonify({
            "success": False,
            "error": ErrorMessages.CAPTURE_SERVICE_RUNNING,
            "suggestion": ErrorMessages.SUGGESTION_STOP_CAPTURE
        }), 409  # 409 Conflict

    try:
        # Load config
        with open(PathConfig.CONFIG_PATH, 'r') as f:
            config = json.load(f)

        result = CameraService.capture_now(config, PathConfig.IMAGES_DIR)
        if result["success"]:
            return jsonify(result)
        else:
            return jsonify(result), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@camera_bp.route('/api/stream/start', methods=['POST'])
def start_stream():
    """Start camera stream"""
    # Check if capture service is running
    if SystemdService.is_service_active('capture'):
        return jsonify({
            "success": False,
            "error": ErrorMessages.CAPTURE_SERVICE_RUNNING,
            "suggestion": ErrorMessages.SUGGESTION_STOP_CAPTURE
        }), 409  # 409 Conflict

    result = stream_manager.start(str(PathConfig.CONFIG_PATH))
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 500


@camera_bp.route('/api/stream/stop', methods=['POST'])
def stop_stream():
    """Stop camera stream"""
    result = stream_manager.stop()
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 400


@camera_bp.route('/api/stream/status', methods=['GET'])
def stream_status():
    """Get stream status"""
    try:
        from picamera2 import Picamera2
        has_camera = True
    except ImportError:
        has_camera = False

    return jsonify({
        "success": True,
        "active": stream_manager.is_active,
        "available": has_camera
    })


@camera_bp.route('/video_feed')
def video_feed():
    """Video streaming route"""
    if not stream_manager.is_active:
        return "Stream not active. Start it first.", 503

    return Response(stream_manager.generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')
