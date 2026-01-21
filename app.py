#!/usr/bin/env python3
"""
Aquarium Timelapse Web Application
Main entry point using modular architecture
"""

from api import create_app

# Create Flask application
app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
