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
    HAS_CAMERA = False

app = Flask(__name__)

# Configuration
IMAGES_DIR = "/home/saainithil97/projects/timelapse/images"
CONFIG_PATH = "/home/saainithil97/projects/timelapse/config.json"
LOG_PATH = "/home/saainithil97/projects/timelapse/logs/timelapse.log"
SCHEMA_PATH = "/home/saainithil97/projects/timelapse/config_schema.json"

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
        services = {
            'capture': get_systemctl_status('timelapse.service'),
            'sync_timer': get_systemctl_status('timelapse-sync.timer'),
            'cleanup_timer': get_systemctl_status('timelapse-cleanup.timer')
        }
        return jsonify({"success": True, "services": services})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/service/<action>', methods=['POST'])
def control_service(action):
    """Control services (start/stop/restart)"""
    try:
        service = request.json.get('service', 'timelapse.service')
        
        # Validate action
        if action not in ['start', 'stop', 'restart']:
            return jsonify({"success": False, "error": "Invalid action"}), 400
        
        # Validate service name
        valid_services = ['timelapse.service', 'timelapse-sync.timer', 'timelapse-cleanup.timer']
        if service not in valid_services:
            return jsonify({"success": False, "error": "Invalid service"}), 400
        
        # Execute systemctl command
        cmd = ['systemctl', '--user', action, service]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            return jsonify({
                "success": True, 
                "message": f"Service {service} {action}ed successfully",
                "status": get_systemctl_status(service)
            })
        else:
            return jsonify({
                "success": False, 
                "error": result.stderr or "Command failed"
            }), 500
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": "Command timed out"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

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
            stream_camera = None
            return jsonify({"success": False, "error": str(e)}), 500

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
