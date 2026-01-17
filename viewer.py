#!/usr/bin/env python3
"""
Beautiful Flask web app to view latest timelapse photo
Using Tailwind CSS + DaisyUI
"""

from flask import Flask, render_template, send_file, jsonify
import os
from datetime import datetime
from pathlib import Path

app = Flask(__name__)

# Configuration
IMAGES_DIR = "/home/saainithil97/projects/timelapse/images"

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
