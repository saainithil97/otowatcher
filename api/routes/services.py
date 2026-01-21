"""
Service Routes
Endpoints for systemd service management
"""

from flask import Blueprint, jsonify, request

from api.services import SystemdService

# Create blueprint
services_bp = Blueprint('services', __name__)


@services_bp.route('/api/service/status', methods=['GET'])
def get_service_status():
    """Get status of all services"""
    try:
        services = SystemdService.get_all_services_status()
        return jsonify({"success": True, "services": services})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@services_bp.route('/api/service/<action>', methods=['POST'])
def control_service(action):
    """Control services (start/stop/restart)"""
    try:
        # Get service name from request body
        request_data = request.get_json(silent=True)
        if not request_data:
            return jsonify({"success": False, "error": "No request body provided"}), 400

        service_key = request_data.get('service', 'capture')

        # Use service layer
        result = SystemdService.control_service(action, service_key)

        if result["success"]:
            return jsonify(result)
        else:
            return jsonify(result), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
