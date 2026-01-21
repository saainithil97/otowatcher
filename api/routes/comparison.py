"""
Comparison Routes
Endpoints for image comparison
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta

from api.services import ImageService
from config_constants import PathConfig

# Create blueprint
comparison_bp = Blueprint('comparison', __name__)

# Initialize service
image_service = ImageService(str(PathConfig.IMAGES_DIR))


@comparison_bp.route('/api/compare/quick', methods=['GET'])
def compare_quick():
    """Quick comparison - get latest image and image from N days ago"""
    try:
        days_ago = int(request.args.get('days_ago', 7))

        # Get latest image
        latest_img = image_service.get_latest_image_info()
        if not latest_img:
            return jsonify({"success": False, "error": "No latest image found"})

        # Calculate target date
        latest_date = datetime.fromisoformat(latest_img['timestamp'])
        target_date = latest_date - timedelta(days=days_ago)

        # Find image from target date (closest to same time of day)
        comparison_img = image_service.find_closest_image(target_date, latest_date.time())

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
