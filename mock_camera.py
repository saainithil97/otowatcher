#!/usr/bin/env python3
"""
Mock camera modules for testing on macOS without Raspberry Pi hardware
"""
import time
import io
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime


class MockTransform:
    """Mock libcamera Transform"""
    def __init__(self, hflip=0, vflip=0):
        self.hflip = hflip
        self.vflip = vflip


class MockControls:
    """Mock libcamera controls"""
    class AeMeteringModeEnum:
        CentreWeighted = 0
        Spot = 1
        Matrix = 2


class MockPicamera2:
    """Mock Picamera2 class for testing without hardware"""
    
    def __init__(self):
        self.camera_config = {}
        self.controls = {}
        self._running = False
        
    def create_still_configuration(self, main=None, transform=None):
        """Mock configuration creation"""
        return {
            "main": main or {"size": (4056, 3040)},
            "transform": transform
        }
    
    def configure(self, config):
        """Mock configure"""
        self.camera_config = config
        
    def start(self):
        """Mock camera start"""
        self._running = True
        time.sleep(0.1)  # Simulate startup time
        
    def stop(self):
        """Mock camera stop"""
        self._running = False
        
    def close(self):
        """Mock camera close"""
        self._running = False
        
    def set_controls(self, controls):
        """Mock set controls"""
        self.controls.update(controls)
        
    def capture_file(self, output_path):
        """Mock capture - creates a test image with timestamp"""
        # Create a test image
        img = Image.new('RGB', (800, 600), color=(73, 109, 137))
        d = ImageDraw.Draw(img)
        
        # Add timestamp text
        text = f"Mock Image\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        try:
            # Try to use a nice font
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
        except:
            # Fallback to default
            font = ImageFont.load_default()
            
        # Calculate text position (center)
        bbox = d.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        position = ((800 - text_width) / 2, (600 - text_height) / 2)
        
        d.text(position, text, fill=(255, 255, 255), font=font)
        
        # Save the image
        img.save(output_path, 'JPEG', quality=90)
        
    def capture_metadata(self):
        """Mock capture metadata"""
        return {
            "ExposureTime": 10000,
            "AnalogueGain": 1.5,
            "ColourGains": (1.5, 1.8),
            "Brightness": 0.0,
            "Contrast": 1.0
        }
    
    def capture_array(self):
        """Mock capture as numpy array"""
        import numpy as np
        # Return a simple RGB array
        return np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)


# Create mock modules
class libcamera:
    Transform = MockTransform
    controls = MockControls()


class picamera2:
    Picamera2 = MockPicamera2
