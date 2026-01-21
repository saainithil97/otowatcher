"""
Calendar Routes
Endpoints for calendar-based image filtering
"""

from flask import Blueprint, jsonify, request
from datetime import datetime

from api.services import ImageService
from config_constants import PathConfig

# Create blueprint
calendar_bp = Blueprint('calendar', __name__)

# Initialize service
image_service = ImageService(str(PathConfig.IMAGES_DIR))


@calendar_bp.route('/api/calendar/days', methods=['GET'])
def calendar_days():
    """Get days in a month that have images"""
    try:
        year = int(request.args.get('year', datetime.now().year))
        month = int(request.args.get('month', datetime.now().month))

        days_with_images = image_service.get_calendar_days(year, month)

        return jsonify({
            "success": True,
            "days": days_with_images,
            "year": year,
            "month": month
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@calendar_bp.route('/api/calendar/images', methods=['GET'])
def calendar_images():
    """Get all images for a specific date"""
    try:
        date_str = request.args.get('date')  # Format: YYYY-MM-DD
        if not date_str:
            return jsonify({"success": False, "error": "Date parameter required"}), 400

        images = image_service.get_images_for_date(date_str)

        return jsonify({
            "success": True,
            "images": images,
            "date": date_str,
            "count": len(images)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
