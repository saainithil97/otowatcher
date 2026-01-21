#!/usr/bin/env python3
"""
Beautiful Flask web app to view latest timelapse photo
Using Tailwind CSS + DaisyUI
"""

from flask import Flask, render_template, send_file, jsonify, request, Response
import os
import json
import subprocess
import shutil
import threading
import time
import io
from datetime import datetime
from pathlib import Path
try:
    from jsonschema import validate, ValidationError
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

try:
    from picamera2 import Picamera2
    from libcamera import Transform, controls
    HAS_CAMERA = True
except ImportError:
    # Use mock camera for testing on non-Raspberry Pi systems
    try:
        from mock_camera import MockPicamera2 as Picamera2, libcamera
        Transform = libcamera.Transform
        controls = libcamera.controls
        HAS_CAMERA = True
        print("Using mock camera for testing")
    except ImportError:
        HAS_CAMERA = False

app = Flask(__name__)

# Configuration
import sys
import platform

# Use relative paths based on script location (works on any system)
BASE_DIR = Path(__file__).parent
IMAGES_DIR = str(BASE_DIR / "images")
CONFIG_PATH = str(BASE_DIR / "config.json")
LOG_PATH = str(BASE_DIR / "logs" / "timelapse.log")
SCHEMA_PATH = str(BASE_DIR / "config_schema.json")

# For development on macOS, use test_images instead
if platform.system() == 'Darwin':  # macOS
    IMAGES_DIR = str(BASE_DIR / "test_images")

# Load schema
CONFIG_SCHEMA = None
if HAS_JSONSCHEMA and os.path.exists(SCHEMA_PATH):
    try:
        with open(SCHEMA_PATH, 'r') as f:
            CONFIG_SCHEMA = json.load(f)
    except:
        pass

# Live stream state
stream_camera = None
stream_active = False
stream_lock = threading.Lock()

def get_latest_image():
    """Find the most recent image"""
    try:
        all_images = []
        for date_dir in Path(IMAGES_DIR).iterdir():
            if date_dir.is_dir():
                for img in date_dir.glob("*.jpg"):
                    all_images.append(img)
        
        if not all_images:
            return None
        
        # Sort by modification time
        latest = max(all_images, key=lambda p: p.stat().st_mtime)
        return latest
    except Exception as e:
        print(f"Error finding latest image: {e}")
        return None

def get_recent_images(count=10):
    """Get the most recent N images"""
    try:
        all_images = []
        for date_dir in Path(IMAGES_DIR).iterdir():
            if date_dir.is_dir():
                for img in date_dir.glob("*.jpg"):
                    all_images.append(img)
        
        if not all_images:
            return []
        
        # Sort by modification time and get latest N
        recent = sorted(all_images, key=lambda p: p.stat().st_mtime, reverse=True)[:count]
        return recent
    except Exception as e:
        print(f"Error finding recent images: {e}")
        return []

def get_image_stats():
    """Get statistics about images"""
    try:
        total_images = sum(1 for p in Path(IMAGES_DIR).rglob("*.jpg"))
        disk_usage = sum(p.stat().st_size for p in Path(IMAGES_DIR).rglob("*.jpg")) / (1024**3)  # GB
        
        # Count images today
        today = datetime.now().strftime("%Y-%m-%d")
        today_path = Path(IMAGES_DIR) / today
        today_images = len(list(today_path.glob("*.jpg"))) if today_path.exists() else 0
        
        latest = get_latest_image()
        if latest:
            latest_time = datetime.fromtimestamp(latest.stat().st_mtime)
        else:
            latest_time = None
        
        return {
            "total_images": total_images,
            "today_images": today_images,
            "disk_usage_gb": round(disk_usage, 2),
            "latest_time": latest_time
        }
    except Exception as e:
        return {"error": str(e)}

@app.route('/')
def index():
    """Main page showing latest image"""
    latest = get_latest_image()
    stats = get_image_stats()
    
    return render_template('index.html', 
                         has_image=(latest is not None),
                         stats=stats)

@app.route('/latest.jpg')
def latest_image():
    """Serve the latest image"""
    latest = get_latest_image()
    if latest:
        return send_file(latest, mimetype='image/jpeg')
    else:
        return "No images found", 404

@app.route('/api/stats')
def api_stats():
    """API endpoint for stats"""
    stats = get_image_stats()
    if stats.get('latest_time'):
        stats['latest_time'] = stats['latest_time'].isoformat()
    return jsonify(stats)

@app.route('/api/gallery')
def api_gallery():
    """API endpoint for gallery images"""
    try:
        count = int(request.args.get('count', 20))
        recent = get_recent_images(count)
        
        images_info = []
        for img in recent:
            images_info.append({
                'filename': img.name,
                'path': str(img.relative_to(IMAGES_DIR)),
                'timestamp': datetime.fromtimestamp(img.stat().st_mtime).isoformat(),
                'timestamp_display': datetime.fromtimestamp(img.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                'time_only': datetime.fromtimestamp(img.stat().st_mtime).strftime('%H:%M:%S'),
                'date_only': datetime.fromtimestamp(img.stat().st_mtime).strftime('%b %d, %Y'),
                'size_mb': round(img.stat().st_size / (1024**2), 2)
            })
        
        return jsonify({'success': True, 'images': images_info})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/gallery')
def gallery():
    """Gallery view showing recent images"""
    recent = get_recent_images(20)
    stats = get_image_stats()
    
    # Convert to list of dicts with info
    images_info = []
    for img in recent:
        images_info.append({
            'filename': img.name,
            'path': str(img.relative_to(IMAGES_DIR)),
            'timestamp': datetime.fromtimestamp(img.stat().st_mtime),
            'size_mb': round(img.stat().st_size / (1024**2), 2)
        })
    
    return render_template('gallery.html', images=images_info, stats=stats)

@app.route('/image/<path:filepath>')
def serve_image(filepath):
    """Serve any image from the images directory"""
    img_path = Path(IMAGES_DIR) / filepath
    if img_path.exists() and img_path.suffix == '.jpg':
        return send_file(img_path, mimetype='image/jpeg')
    return "Image not found", 404

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get current configuration"""
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
        return jsonify({"success": True, "config": config})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/config', methods=['POST'])
def update_config():
    """Update configuration with validation"""
    backup_path = CONFIG_PATH + '.backup'
    try:
        new_config = request.json
        
        # Validate with JSON schema if available
        if HAS_JSONSCHEMA and CONFIG_SCHEMA:
            try:
                validate(instance=new_config, schema=CONFIG_SCHEMA)
            except ValidationError as e:
                return jsonify({"success": False, "error": f"Validation error: {e.message}"}), 400
        else:
            # Basic validation
            required_fields = ['capture_interval_seconds', 'resolution', 'storage_path', 'log_path']
            for field in required_fields:
                if field not in new_config:
                    return jsonify({"success": False, "error": f"Missing required field: {field}"}), 400
        
        # Backup current config
        shutil.copy2(CONFIG_PATH, backup_path)
        
        # Write new config
        with open(CONFIG_PATH, 'w') as f:
            json.dump(new_config, f, indent=2)
        
        return jsonify({"success": True, "message": "Configuration updated successfully"})
    except Exception as e:
        # Restore backup on error
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, CONFIG_PATH)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/service/status', methods=['GET'])
def get_service_status():
    """Get status of all services"""
    try:
        # Service names for display
        service_names = {
            'capture': 'Image Capture Service',
            'sync_timer': 'Google Drive Sync Timer',
            'cleanup_timer': 'Image Cleanup Timer'
        }

        services = {}
        for key, service_file in [('capture', 'timelapse.service'),
                                   ('sync_timer', 'timelapse-sync.timer'),
                                   ('cleanup_timer', 'timelapse-cleanup.timer')]:
            status = get_systemctl_status(service_file)
            status['name'] = service_names[key]
            services[key] = status

        return jsonify({"success": True, "services": services})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/service/<action>', methods=['POST'])
def control_service(action):
    """Control services (start/stop/restart)"""
    try:
        # Get service name from request body
        request_data = request.get_json(silent=True)
        if not request_data:
            return jsonify({"success": False, "error": "No request body provided"}), 400

        service_key = request_data.get('service', 'capture')

        # Map service keys to actual systemd service names
        service_map = {
            'capture': 'timelapse.service',
            'sync_timer': 'timelapse-sync.timer',
            'cleanup_timer': 'timelapse-cleanup.timer',
            # Also accept full service names for backward compatibility
            'timelapse.service': 'timelapse.service',
            'timelapse-sync.timer': 'timelapse-sync.timer',
            'timelapse-cleanup.timer': 'timelapse-cleanup.timer'
        }

        service = service_map.get(service_key)
        if not service:
            return jsonify({"success": False, "error": f"Invalid service: {service_key}"}), 400

        # Validate action
        if action not in ['start', 'stop', 'restart']:
            return jsonify({"success": False, "error": f"Invalid action: {action}"}), 400
        
        # Execute systemctl command
        cmd = ['systemctl', '--user', action, service]
        print(f"Executing: {' '.join(cmd)}")  # Debug logging
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        print(f"Return code: {result.returncode}")  # Debug logging
        print(f"Stdout: {result.stdout}")  # Debug logging
        print(f"Stderr: {result.stderr}")  # Debug logging
        
        if result.returncode == 0:
            return jsonify({
                "success": True, 
                "message": f"Service {service} {action}ed successfully",
                "status": get_systemctl_status(service)
            })
        else:
            error_msg = result.stderr.strip() if result.stderr else result.stdout.strip()
            if not error_msg:
                error_msg = f"Command failed with return code {result.returncode}"
            
            return jsonify({
                "success": False, 
                "error": error_msg,
                "debug": {
                    "command": ' '.join(cmd),
                    "return_code": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            }), 500
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False, 
            "error": "Command timed out after 10 seconds"
        }), 500
    except Exception as e:
        import traceback
        return jsonify({
            "success": False, 
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get recent log entries"""
    try:
        lines = int(request.args.get('lines', 50))
        log_type = request.args.get('type', 'timelapse')
        
        log_files = {
            'timelapse': LOG_PATH,
            'sync': '/home/saainithil97/projects/timelapse/logs/sync.log',
            'cleanup': '/home/saainithil97/projects/timelapse/logs/cleanup.log'
        }
        
        log_file = log_files.get(log_type, LOG_PATH)
        
        if not os.path.exists(log_file):
            return jsonify({"success": True, "logs": []})
        
        # Read last N lines
        with open(log_file, 'r') as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        return jsonify({"success": True, "logs": recent_lines})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def get_health():
    """Get system health metrics"""
    try:
        # Disk usage
        stat = os.statvfs(IMAGES_DIR)
        total_space = stat.f_blocks * stat.f_frsize
        free_space = stat.f_bavail * stat.f_frsize
        used_space = total_space - free_space
        disk_usage_percent = (used_space / total_space) * 100
        
        # Last sync time (from sync log)
        last_sync = None
        sync_log = '/home/saainithil97/projects/timelapse/logs/sync.log'
        if os.path.exists(sync_log):
            with open(sync_log, 'r') as f:
                lines = f.readlines()
                for line in reversed(lines):
                    if 'Sync completed:' in line:
                        try:
                            # Extract timestamp
                            last_sync = line.split('Sync completed:')[1].strip()
                            break
                        except:
                            pass
        
        health = {
            "disk_usage_percent": round(disk_usage_percent, 2),
            "disk_free_gb": round(free_space / (1024**3), 2),
            "disk_total_gb": round(total_space / (1024**3), 2),
            "last_sync": last_sync,
            "warnings": []
        }
        
        # Add warnings
        if disk_usage_percent > 80:
            health["warnings"].append(f"Disk usage high: {disk_usage_percent:.1f}%")
        
        return jsonify({"success": True, "health": health})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

def get_systemctl_status(service):
    """Helper to get systemctl status"""
    try:
        cmd = ['systemctl', '--user', 'is-active', service]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        active = result.stdout.strip() == 'active'
        
        # Get more details
        cmd = ['systemctl', '--user', 'show', service, '--property=ActiveState,SubState,ExecMainStartTimestamp']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        
        details = {}
        for line in result.stdout.strip().split('\n'):
            if '=' in line:
                key, value = line.split('=', 1)
                details[key] = value
        
        return {
            "active": active,
            "state": details.get('ActiveState', 'unknown'),
            "substate": details.get('SubState', 'unknown'),
            "started": details.get('ExecMainStartTimestamp', 'unknown')
        }
    except Exception as e:
        return {
            "active": False,
            "state": "error",
            "error": str(e)
        }

def apply_stream_camera_settings(picam2, config_path=CONFIG_PATH):
    """Apply camera settings to stream camera"""
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        camera_settings = config.get('camera_settings', {})
        camera_controls = {}
        
        if 'exposure_compensation' in camera_settings:
            camera_controls['ExposureValue'] = camera_settings['exposure_compensation']
        
        awb_mode = camera_settings.get('awb_mode', 'auto').lower()
        if awb_mode == 'auto':
            camera_controls['AwbEnable'] = True
        elif awb_mode == 'custom':
            camera_controls['AwbEnable'] = False
            camera_controls['ColourGains'] = (
                camera_settings.get('awb_gains_red', 1.5),
                camera_settings.get('awb_gains_blue', 1.8)
            )
        
        metering = camera_settings.get('metering_mode', 'CentreWeighted')
        if metering == 'CentreWeighted':
            camera_controls['AeMeteringMode'] = controls.AeMeteringModeEnum.CentreWeighted
        elif metering == 'Spot':
            camera_controls['AeMeteringMode'] = controls.AeMeteringModeEnum.Spot
        
        if 'sharpness' in camera_settings:
            camera_controls['Sharpness'] = camera_settings['sharpness']
        if 'contrast' in camera_settings:
            camera_controls['Contrast'] = camera_settings['contrast']
        if 'brightness' in camera_settings:
            camera_controls['Brightness'] = camera_settings['brightness']
        if 'saturation' in camera_settings:
            camera_controls['Saturation'] = camera_settings['saturation']
        
        picam2.set_controls(camera_controls)
        return True
    except Exception as e:
        print(f"Error applying camera settings: {e}")
        return False

def generate_frames():
    """Generate frames for MJPEG streaming"""
    global stream_camera, stream_active
    
    while stream_active:
        try:
            if stream_camera is None:
                break
            
            # Capture frame as JPEG
            buffer = io.BytesIO()
            stream_camera.capture_file(buffer, format='jpeg')
            frame = buffer.getvalue()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            
            time.sleep(0.1)  # ~10 fps
        except Exception as e:
            print(f"Error generating frame: {e}")
            break

@app.route('/api/stream/start', methods=['POST'])
def start_stream():
    """Start camera stream"""
    global stream_camera, stream_active
    
    if not HAS_CAMERA:
        return jsonify({"success": False, "error": "Camera not available on this system"}), 500
    
    with stream_lock:
        if stream_active:
            return jsonify({"success": False, "error": "Stream already active"}), 400
        
        # Check if capture service is running
        try:
            capture_status = get_systemctl_status('timelapse.service')
            if capture_status.get('active'):
                return jsonify({
                    "success": False, 
                    "error": "Capture service is running. Stop it first to use the camera.",
                    "suggestion": "Go to Services tab and click 'Stop' on Capture Service"
                }), 409  # 409 Conflict
        except:
            pass  # If we can't check, proceed anyway
        
        try:
            # Initialize camera for streaming (lower resolution for bandwidth)
            stream_camera = Picamera2()
            config = stream_camera.create_video_configuration(
                main={"size": (1280, 960)},
                transform=Transform(hflip=0, vflip=0, rotation=270)
            )
            stream_camera.configure(config)
            stream_camera.start()
            time.sleep(1)  # Let camera adjust
            
            # Apply settings from config
            apply_stream_camera_settings(stream_camera)
            
            stream_active = True
            return jsonify({"success": True, "message": "Stream started"})
        except Exception as e:
            # Clean up on error
            if stream_camera:
                try:
                    stream_camera.close()
                except:
                    pass
            stream_camera = None
            
            error_msg = str(e)
            suggestion = ""
            
            if "did not complete" in error_msg or "Camera is in use" in error_msg:
                suggestion = "The camera is busy. Make sure the capture service is stopped (Services tab → Stop Capture Service)."
            elif "No such file or directory" in error_msg:
                suggestion = "Camera hardware not detected. Check camera connection."
            
            return jsonify({
                "success": False, 
                "error": error_msg,
                "suggestion": suggestion
            }), 500

@app.route('/api/stream/stop', methods=['POST'])
def stop_stream():
    """Stop camera stream"""
    global stream_camera, stream_active
    
    with stream_lock:
        if not stream_active:
            return jsonify({"success": False, "error": "Stream not active"}), 400
        
        try:
            stream_active = False
            if stream_camera:
                stream_camera.stop()
                stream_camera.close()
                stream_camera = None
            return jsonify({"success": True, "message": "Stream stopped"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/stream/status', methods=['GET'])
def stream_status():
    """Get stream status"""
    return jsonify({
        "success": True,
        "active": stream_active,
        "available": HAS_CAMERA
    })

@app.route('/video_feed')
def video_feed():
    """Video streaming route"""
    if not stream_active:
        return "Stream not active. Start it first.", 503
    
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/debug/systemctl', methods=['GET'])
def debug_systemctl():
    """Debug endpoint to test systemctl access"""
    try:
        results = {}
        
        # Test basic systemctl --user command
        cmd = ['systemctl', '--user', '--version']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        results['systemctl_version'] = {
            'returncode': result.returncode,
            'stdout': result.stdout[:200],
            'stderr': result.stderr[:200]
        }
        
        # List user services
        cmd = ['systemctl', '--user', 'list-units', '--type=service', '--all']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        results['list_services'] = {
            'returncode': result.returncode,
            'stdout': result.stdout[:500],
            'has_timelapse': 'timelapse.service' in result.stdout
        }
        
        # Check specific service
        cmd = ['systemctl', '--user', 'status', 'timelapse.service']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        results['timelapse_status'] = {
            'returncode': result.returncode,
            'stdout': result.stdout[:500],
            'stderr': result.stderr[:200]
        }
        
        return jsonify({'success': True, 'results': results})
    except Exception as e:
        import traceback
        return jsonify({
            'success': False, 
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/capture', methods=['POST'])
def capture_now():
    """Capture an image immediately using config.json settings"""
    if not HAS_CAMERA:
        return jsonify({
            "success": False, 
            "error": "Camera not available on this system"
        }), 500
    
    try:
        # Check if capture service is running (can't use camera if it is)
        try:
            capture_status = get_systemctl_status('timelapse.service')
            if capture_status.get('active'):
                return jsonify({
                    "success": False, 
                    "error": "Capture service is running. Cannot capture while service is active.",
                    "suggestion": "Stop the Capture Service first (Services tab → Stop)"
                }), 409  # 409 Conflict
        except:
            pass  # If we can't check, proceed anyway
        
        # Load config
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
        
        # Get timestamp and create directory structure
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%Y%m%d_%H%M%S")
        
        # Use storage_path from config or fall back to IMAGES_DIR
        storage_path = config.get('storage_path', IMAGES_DIR)
        date_dir = os.path.join(storage_path, date_str)
        os.makedirs(date_dir, exist_ok=True)
        
        output_path = os.path.join(date_dir, f"{time_str}.jpg")
        
        # Initialize camera
        picam2 = Picamera2()
        
        # Create configuration with resolution from config
        resolution = config.get('resolution', '3280x2464')
        if isinstance(resolution, str):
            width, height = map(int, resolution.split('x'))
        else:
            width, height = resolution['width'], resolution['height']
        
        # Rotation: config has 'rotation': 90, but libcamera wants 270 for clockwise
        # Apply inverse: if config says 90 (clockwise), use 270 in libcamera
        config_rotation = config.get('rotation', 90)
        libcamera_rotation = (360 - config_rotation) % 360
        
        capture_config = picam2.create_still_configuration(
            main={"size": (width, height)},
            transform=Transform(hflip=0, vflip=0, rotation=libcamera_rotation)
        )
        picam2.configure(capture_config)
        picam2.start()
        time.sleep(1)  # Let camera adjust
        
        # Apply camera settings from config
        camera_settings = config.get('camera_settings', {})
        camera_controls = {}
        
        if 'exposure_compensation' in camera_settings:
            camera_controls['ExposureValue'] = camera_settings['exposure_compensation']
        
        awb_mode = camera_settings.get('awb_mode', 'auto').lower()
        if awb_mode == 'auto':
            camera_controls['AwbEnable'] = True
        elif awb_mode == 'custom':
            camera_controls['AwbEnable'] = False
            camera_controls['ColourGains'] = (
                camera_settings.get('awb_gains_red', 1.5),
                camera_settings.get('awb_gains_blue', 1.8)
            )
        
        metering = camera_settings.get('metering_mode', 'CentreWeighted')
        if metering == 'CentreWeighted':
            camera_controls['AeMeteringMode'] = controls.AeMeteringModeEnum.CentreWeighted
        elif metering == 'Spot':
            camera_controls['AeMeteringMode'] = controls.AeMeteringModeEnum.Spot
        
        if 'sharpness' in camera_settings:
            camera_controls['Sharpness'] = camera_settings['sharpness']
        if 'contrast' in camera_settings:
            camera_controls['Contrast'] = camera_settings['contrast']
        if 'brightness' in camera_settings:
            camera_controls['Brightness'] = camera_settings['brightness']
        if 'saturation' in camera_settings:
            camera_controls['Saturation'] = camera_settings['saturation']
        
        if camera_controls:
            picam2.set_controls(camera_controls)
        
        # Capture image
        picam2.capture_file(output_path)
        
        # Clean up
        picam2.stop()
        picam2.close()
        
        # Get file info
        file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
        
        return jsonify({
            "success": True,
            "message": "Image captured successfully",
            "path": output_path,
            "filename": f"{time_str}.jpg",
            "date_folder": date_str,
            "size_mb": round(file_size, 2),
            "timestamp": now.isoformat()
        })
    
    except Exception as e:
        # Clean up camera on error
        try:
            if 'picam2' in locals():
                picam2.stop()
                picam2.close()
        except:
            pass
        
        error_msg = str(e)
        suggestion = ""
        
        if "did not complete" in error_msg or "Camera is in use" in error_msg:
            suggestion = "The camera is busy. Make sure the capture service is stopped (Services tab → Stop Capture Service)."
        elif "No such file or directory" in error_msg or "Cannot open device" in error_msg:
            suggestion = "Camera hardware not detected. Check camera connection."
        elif "permission denied" in error_msg.lower():
            suggestion = "Permission denied. Check camera permissions and run with appropriate privileges."
        
        import traceback
        return jsonify({
            "success": False,
            "error": error_msg,
            "suggestion": suggestion,
            "traceback": traceback.format_exc() if app.debug else None
        }), 500

# Calendar API endpoints
@app.route('/api/calendar/days', methods=['GET'])
def calendar_days():
    """Get days in a month that have images"""
    try:
        year = int(request.args.get('year', datetime.now().year))
        month = int(request.args.get('month', datetime.now().month))

        # Get all date folders
        days_with_images = []
        if os.path.exists(IMAGES_DIR):
            for folder in os.listdir(IMAGES_DIR):
                try:
                    # Parse folder name (YYYY-MM-DD format)
                    folder_date = datetime.strptime(folder, '%Y-%m-%d')
                    if folder_date.year == year and folder_date.month == month:
                        folder_path = os.path.join(IMAGES_DIR, folder)
                        # Check if folder has images
                        if os.path.isdir(folder_path):
                            images = [f for f in os.listdir(folder_path) if f.endswith('.jpg')]
                            if images:
                                days_with_images.append(folder)
                except (ValueError, OSError):
                    continue

        return jsonify({
            "success": True,
            "days": sorted(days_with_images),
            "year": year,
            "month": month
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/calendar/images', methods=['GET'])
def calendar_images():
    """Get all images for a specific date"""
    try:
        date_str = request.args.get('date')  # Format: YYYY-MM-DD
        if not date_str:
            return jsonify({"success": False, "error": "Date parameter required"}), 400

        folder_path = os.path.join(IMAGES_DIR, date_str)
        if not os.path.exists(folder_path):
            return jsonify({"success": True, "images": []})

        images = []
        for filename in sorted(os.listdir(folder_path)):
            if filename.endswith('.jpg'):
                file_path = os.path.join(folder_path, filename)
                file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB

                # Parse timestamp from filename (YYYYMMdd_HHMMSS.jpg)
                try:
                    timestamp = datetime.strptime(filename[:-4], '%Y%m%d_%H%M%S')
                    images.append({
                        'filename': filename,
                        'path': f"{date_str}/{filename}",
                        'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                        'time_only': timestamp.strftime('%H:%M:%S'),
                        'date_only': timestamp.strftime('%b %d, %Y'),
                        'size_mb': round(file_size, 2)
                    })
                except (ValueError, OSError):
                    continue

        return jsonify({
            "success": True,
            "images": images,
            "date": date_str,
            "count": len(images)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Comparison API endpoints
@app.route('/api/compare/quick', methods=['GET'])
def compare_quick():
    """Quick comparison - get latest image and image from N days ago"""
    try:
        days_ago = int(request.args.get('days_ago', 7))

        # Get latest image
        latest_img = get_latest_image_info()
        if not latest_img:
            return jsonify({"success": False, "error": "No latest image found"})

        # Calculate target date
        latest_date = datetime.fromisoformat(latest_img['timestamp'])
        target_date = latest_date - timedelta(days=days_ago)
        target_date_str = target_date.strftime('%Y-%m-%d')

        # Find image from target date (closest to same time of day)
        comparison_img = find_closest_image(target_date, latest_date.time())

        if not comparison_img:
            return jsonify({
                "success": False,
                "error": f"No images found from {days_ago} days ago"
            })

        return jsonify({
            "success": True,
            "img1": latest_img,
            "img2": comparison_img,
            "days_difference": days_ago
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

def get_latest_image_info():
    """Get info about the latest image"""
    try:
        # Get all date folders sorted
        date_folders = sorted([d for d in os.listdir(IMAGES_DIR)
                              if os.path.isdir(os.path.join(IMAGES_DIR, d))], reverse=True)

        for date_folder in date_folders:
            folder_path = os.path.join(IMAGES_DIR, date_folder)
            images = sorted([f for f in os.listdir(folder_path) if f.endswith('.jpg')], reverse=True)

            if images:
                latest_file = images[0]
                file_path = os.path.join(folder_path, latest_file)
                file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB

                timestamp = datetime.strptime(latest_file[:-4], '%Y%m%d_%H%M%S')
                return {
                    'filename': latest_file,
                    'path': f"{date_folder}/{latest_file}",
                    'timestamp': timestamp.isoformat(),
                    'size_mb': round(file_size, 2)
                }
        return None
    except Exception as e:
        print(f"Error getting latest image: {e}")
        return None

def find_closest_image(target_date, target_time):
    """Find image closest to target date and time"""
    try:
        target_date_str = target_date.strftime('%Y-%m-%d')
        folder_path = os.path.join(IMAGES_DIR, target_date_str)

        if not os.path.exists(folder_path):
            # Try adjacent days if exact date doesn't exist
            for offset in [-1, 1, -2, 2]:
                alt_date = target_date + timedelta(days=offset)
                alt_date_str = alt_date.strftime('%Y-%m-%d')
                folder_path = os.path.join(IMAGES_DIR, alt_date_str)
                if os.path.exists(folder_path):
                    target_date_str = alt_date_str
                    break
            else:
                return None

        images = [f for f in os.listdir(folder_path) if f.endswith('.jpg')]
        if not images:
            return None

        # Find image closest to target time
        target_seconds = target_time.hour * 3600 + target_time.minute * 60 + target_time.second
        closest_img = None
        closest_diff = float('inf')

        for img_file in images:
            try:
                img_time = datetime.strptime(img_file[:-4], '%Y%m%d_%H%M%S')
                img_seconds = img_time.hour * 3600 + img_time.minute * 60 + img_time.second
                diff = abs(img_seconds - target_seconds)

                if diff < closest_diff:
                    closest_diff = diff
                    closest_img = img_file
            except (ValueError, OSError):
                continue

        if closest_img:
            file_path = os.path.join(folder_path, closest_img)
            file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
            timestamp = datetime.strptime(closest_img[:-4], '%Y%m%d_%H%M%S')

            return {
                'filename': closest_img,
                'path': f"{target_date_str}/{closest_img}",
                'timestamp': timestamp.isoformat(),
                'size_mb': round(file_size, 2)
            }
        return None
    except Exception as e:
        print(f"Error finding closest image: {e}")
        return None

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
