"""
API Routes
Blueprint registration for all routes
"""

from .images import images_bp
from .camera import camera_bp
from .services import services_bp
from .config import config_bp
from .calendar import calendar_bp
from .comparison import comparison_bp

__all__ = [
    'images_bp',
    'camera_bp',
    'services_bp',
    'config_bp',
    'calendar_bp',
    'comparison_bp'
]
