"""
Configuration Routes
Endpoints for configuration management
"""

from flask import Blueprint, jsonify, request
import json
import shutil

from config_constants import PathConfig, ErrorMessages

try:
    from jsonschema import validate, ValidationError
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

# Create blueprint
config_bp = Blueprint('config', __name__)

# Load schema if available
CONFIG_SCHEMA = None
if HAS_JSONSCHEMA and PathConfig.SCHEMA_PATH.exists():
    try:
        with open(PathConfig.SCHEMA_PATH, 'r') as f:
            CONFIG_SCHEMA = json.load(f)
    except:
        pass


@config_bp.route('/api/config', methods=['GET'])
def get_config():
    """Get current configuration"""
    try:
        with open(PathConfig.CONFIG_PATH, 'r') as f:
            config = json.load(f)
        return jsonify({"success": True, "config": config})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@config_bp.route('/api/config', methods=['POST'])
def update_config():
    """Update configuration with validation"""
    backup_path = str(PathConfig.CONFIG_PATH) + '.backup'
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
                    return jsonify({
                        "success": False,
                        "error": f"{ErrorMessages.CONFIG_MISSING_FIELD}: {field}"
                    }), 400

        # Backup current config
        shutil.copy2(PathConfig.CONFIG_PATH, backup_path)

        # Write new config
        with open(PathConfig.CONFIG_PATH, 'w') as f:
            json.dump(new_config, f, indent=2)

        return jsonify({"success": True, "message": "Configuration updated successfully"})
    except Exception as e:
        # Restore backup on error
        try:
            shutil.copy2(backup_path, PathConfig.CONFIG_PATH)
        except:
            pass
        return jsonify({"success": False, "error": str(e)}), 500
