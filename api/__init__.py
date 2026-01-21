"""
API Module
Flask application factory and initialization
"""

from flask import Flask, render_template

from config_constants import PathConfig


def create_app():
    """Application factory"""
    app = Flask(__name__,
                template_folder='../templates',
                static_folder='../static')

    # Ensure directories exist
    PathConfig.ensure_directories()

    # Register blueprints
    from api.routes import (
        images_bp,
        camera_bp,
        services_bp,
        config_bp,
        calendar_bp,
        comparison_bp
    )

    app.register_blueprint(images_bp)
    app.register_blueprint(camera_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(config_bp)
    app.register_blueprint(calendar_bp)
    app.register_blueprint(comparison_bp)

    # Keep index route in main app (not moved to blueprint)
    @app.route('/')
    def index():
        """Main page - serves React SPA"""
        from api.services import ImageService
        image_service = ImageService(str(PathConfig.IMAGES_DIR))

        latest = image_service.get_latest_image()
        stats = image_service.get_image_stats()

        return render_template('index.html',
                             has_image=(latest is not None),
                             stats=stats)

    return app
