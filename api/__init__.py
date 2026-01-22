"""
API Module
Flask application factory and initialization
"""

from flask import Flask, send_from_directory
from pathlib import Path

from config_constants import PathConfig


def create_app():
    """Application factory"""
    # Point to static directory (deployed React build)
    # Note: frontend/deploy.sh deploys dist/ to static/
    static_dir = Path(__file__).parent.parent / 'static'

    app = Flask(__name__,
                static_folder=str(static_dir / 'assets'),
                static_url_path='/assets')

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

    # Serve React SPA
    @app.route('/')
    def index():
        """Serve React SPA index.html"""
        return send_from_directory(static_dir, 'index.html')

    # Catch-all route for React Router (SPA routing)
    @app.route('/<path:path>')
    def catch_all(path):
        """Catch-all for React Router - serve index.html for client-side routing"""
        # Check if it's a file request (has extension)
        if '.' in path.split('/')[-1]:
            # Try to serve the file from static
            try:
                return send_from_directory(static_dir, path)
            except:
                return send_from_directory(static_dir, 'index.html')
        # Otherwise, let React Router handle it
        return send_from_directory(static_dir, 'index.html')

    return app
