"""
Image Routes
Endpoints for serving images and gallery
"""

from flask import Blueprint, send_file, jsonify, request
from pathlib import Path

from api.services import ImageService
from config_constants import PathConfig, APIDefaults

# Create blueprint
images_bp = Blueprint('images', __name__)

# Initialize service
image_service = ImageService(str(PathConfig.IMAGES_DIR))


@images_bp.route('/latest.jpg')
def latest_image():
    """Serve the latest image"""
    latest = image_service.get_latest_image()
    if latest:
        return send_file(latest, mimetype='image/jpeg')
    else:
        return "No images found", 404


@images_bp.route('/image/<path:filepath>')
def serve_image(filepath):
    """Serve any image from the images directory"""
    img_path = PathConfig.IMAGES_DIR / filepath
    if img_path.exists() and img_path.suffix == '.jpg':
        return send_file(img_path, mimetype='image/jpeg')
    return "Image not found", 404


@images_bp.route('/api/stats')
def api_stats():
    """API endpoint for stats"""
    stats = image_service.get_image_stats()
    if stats.get('latest_time'):
        stats['latest_time'] = stats['latest_time'].isoformat()
    return jsonify(stats)


@images_bp.route('/api/gallery')
def api_gallery():
    """API endpoint for gallery images"""
    try:
        count = int(request.args.get('count', APIDefaults.DEFAULT_GALLERY_COUNT))
        recent = image_service.get_recent_images(count)

        images_info = []
        for img in recent:
            images_info.append(image_service.get_image_info(img))

        return jsonify({'success': True, 'images': images_info})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
