#!/usr/bin/env python3
"""
Aquarium Timelapse Capture Script
Captures images at regular intervals with configurable settings
"""

import json
import time
import os
import sys
from datetime import datetime, timedelta, time as dt_time
from pathlib import Path
import logging
from picamera2 import Picamera2
from libcamera import Transform, controls
import signal

# Global flag for graceful shutdown
shutdown_flag = False

def signal_handler(sig, frame):
    """Handle shutdown signals gracefully"""
    global shutdown_flag
    shutdown_flag = True
    logging.info("Shutdown signal received, finishing current operation...")

def load_config(config_path=None):
    """Load configuration from JSON file"""
    if config_path is None:
        # Use script directory if not specified
        config_path = os.path.join(os.path.dirname(__file__), "config.json")
    
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error(f"Config file not found: {config_path}")
        sys.exit(1)
    except json.JSONDecodeError:
        logging.error(f"Invalid JSON in config file: {config_path}")
        sys.exit(1)

def setup_logging(log_path):
    """Configure logging"""
    log_dir = os.path.dirname(log_path)
    os.makedirs(log_dir, exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_path),
            logging.StreamHandler(sys.stdout)
        ]
    )

def check_light_level(picam2, threshold):
    """
    Check if aquarium lights are on by analyzing exposure
    Returns True if lights are on, False otherwise
    """
    try:
        # Capture metadata to check exposure
        metadata = picam2.capture_metadata()
        
        # Get exposure time and analog gain as indicators of light level
        exposure_time = metadata.get("ExposureTime", 0)
        analog_gain = metadata.get("AnalogueGain", 0)
        
        # Lower exposure time typically means more light
        # This is a simple heuristic - you may need to adjust
        light_score = 1000000 / (exposure_time * analog_gain + 1)
        
        logging.debug(f"Light score: {light_score:.2f} (threshold: {threshold})")
        return light_score > threshold
    except Exception as e:
        logging.warning(f"Could not check light level: {e}")
        return True  # Assume lights are on if we can't check

def cleanup_old_images(base_path, keep_days):
    """Remove images older than keep_days"""
    try:
        cutoff_date = datetime.now() - timedelta(days=keep_days)
        base_path = Path(base_path)
        
        if not base_path.exists():
            return
        
        deleted_count = 0
        for date_dir in base_path.iterdir():
            if not date_dir.is_dir():
                continue
            
            try:
                # Parse directory name as date (YYYY-MM-DD format)
                dir_date = datetime.strptime(date_dir.name, "%Y-%m-%d")
                
                if dir_date < cutoff_date:
                    # Delete all images in this directory
                    for img_file in date_dir.glob("*.jpg"):
                        img_file.unlink()
                        deleted_count += 1
                    
                    # Remove empty directory
                    if not any(date_dir.iterdir()):
                        date_dir.rmdir()
                        logging.info(f"Removed old directory: {date_dir.name}")
            except ValueError:
                # Skip directories that don't match date format
                continue
        
        if deleted_count > 0:
            logging.info(f"Cleaned up {deleted_count} old images")
    except Exception as e:
        logging.error(f"Error during cleanup: {e}")

def is_within_capture_window(config):
    """Check if current time is within the configured capture window"""
    if not config.get('capture_window', {}).get('enabled', False):
        return True
    
    try:
        now = datetime.now().time()
        start_str = config['capture_window']['start_time']
        end_str = config['capture_window']['end_time']
        
        start_time = dt_time.fromisoformat(start_str)
        end_time = dt_time.fromisoformat(end_str)
        
        # Handle overnight windows (e.g., 22:00 to 08:00)
        if start_time <= end_time:
            return start_time <= now <= end_time
        else:
            return now >= start_time or now <= end_time
    except Exception as e:
        logging.warning(f"Error checking capture window: {e}, defaulting to capture")
        return True

def apply_camera_settings(picam2, settings):
    """Apply optimized camera settings for Camera Module v3 (IMX708) with RGB LED aquarium lighting"""
    try:
        camera_controls = {}

        # Exposure compensation (reduce for bright lights)
        if 'exposure_compensation' in settings:
            camera_controls['ExposureValue'] = settings['exposure_compensation']

        # Auto White Balance mode
        awb_mode = settings.get('awb_mode', 'auto').lower()
        if awb_mode == 'auto':
            camera_controls['AwbEnable'] = True
        elif awb_mode == 'custom':
            camera_controls['AwbEnable'] = False
            camera_controls['ColourGains'] = (
                settings.get('awb_gains_red', 1.5),
                settings.get('awb_gains_blue', 1.8)
            )

        # Metering mode for center-weighted exposure
        metering = settings.get('metering_mode', 'CentreWeighted')
        if metering == 'CentreWeighted':
            camera_controls['AeMeteringMode'] = controls.AeMeteringModeEnum.CentreWeighted
        elif metering == 'Spot':
            camera_controls['AeMeteringMode'] = controls.AeMeteringModeEnum.Spot
        elif metering == 'Matrix':
            camera_controls['AeMeteringMode'] = controls.AeMeteringModeEnum.Matrix

        # Camera Module v3 optimizations
        # Noise reduction (leverage IMX708's improved low-light performance)
        if 'noise_reduction_mode' in settings:
            noise_mode = settings['noise_reduction_mode']
            if noise_mode == 'HighQuality':
                camera_controls['NoiseReductionMode'] = controls.draft.NoiseReductionModeEnum.HighQuality
            elif noise_mode == 'Fast':
                camera_controls['NoiseReductionMode'] = controls.draft.NoiseReductionModeEnum.Fast
            elif noise_mode == 'Minimal':
                camera_controls['NoiseReductionMode'] = controls.draft.NoiseReductionModeEnum.Minimal

        # Sharpness (IMX708 has better native sharpness)
        if 'sharpness' in settings:
            camera_controls['Sharpness'] = settings['sharpness']

        # Contrast
        if 'contrast' in settings:
            camera_controls['Contrast'] = settings['contrast']

        # Brightness
        if 'brightness' in settings:
            camera_controls['Brightness'] = settings['brightness']

        # Saturation
        if 'saturation' in settings:
            camera_controls['Saturation'] = settings['saturation']

        # Frame duration limits (for consistent exposure with aquarium lighting flicker)
        if 'frame_duration_limits' in settings:
            min_duration = settings['frame_duration_limits'].get('min_us')
            max_duration = settings['frame_duration_limits'].get('max_us')
            if min_duration and max_duration:
                camera_controls['FrameDurationLimits'] = (min_duration, max_duration)

        picam2.set_controls(camera_controls)
        logging.info(f"Applied Camera Module v3 settings: {camera_controls}")
        return True
    except Exception as e:
        logging.error(f"Failed to apply camera settings: {e}")
        return False

def capture_image(picam2, output_path, quality=90):
    """Capture a single image"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Capture image
        picam2.capture_file(output_path) 
        # Get file size for logging
        file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
        logging.info(f"Captured: {output_path} ({file_size:.2f} MB)")
        return True
    except Exception as e:
        logging.error(f"Failed to capture image: {e}")
        return False

def main():
    """Main timelapse loop"""
    global shutdown_flag
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Load configuration
    config = load_config()
    setup_logging(config['log_path'])
    
    logging.info("=" * 60)
    logging.info("Aquarium Timelapse System Starting")
    logging.info("=" * 60)
    logging.info(f"Capture interval: {config['capture_interval_seconds']}s")
    logging.info(f"Lights only mode: {config['lights_only_mode']}")
    logging.info(f"Image retention: {config['keep_days']} days")
    logging.info(f"Resolution: {config['resolution']['width']}x{config['resolution']['height']}")
    
    # Initialize camera
    try:
        picam2 = Picamera2()

        # Check if HDR mode is enabled (Camera Module v3 feature)
        hdr_enabled = config.get('camera_settings', {}).get('hdr_mode', False)

        # Configure camera for Camera Module v3 (IMX708)
        if hdr_enabled:
            logging.info("HDR mode enabled")
            config_cam = picam2.create_still_configuration(
                main={"size": (config['resolution']['width'],
                              config['resolution']['height'])},
                transform=Transform(hflip=0, vflip=0, rotation=270),  # Rotate 90 degrees
                controls={"HdrMode": 1}  # Enable HDR
            )
        else:
            config_cam = picam2.create_still_configuration(
                main={"size": (config['resolution']['width'],
                              config['resolution']['height'])},
                transform=Transform(hflip=0, vflip=0, rotation=270)  # Rotate 90 degrees
            )
        picam2.configure(config_cam)

        # Start camera
        picam2.start()

        # Camera Module v3 has autofocus - set to continuous AF mode for aquarium
        try:
            picam2.set_controls({
                "AfMode": controls.AfModeEnum.Continuous,
                "AfSpeed": controls.AfSpeedEnum.Fast
            })
            logging.info("Autofocus enabled (Camera Module v3)")
        except Exception as af_error:
            logging.warning(f"Could not enable autofocus: {af_error}")

        time.sleep(2)  # Let camera warm up and adjust

        # Apply optimized camera settings for Camera Module v3 with RGB LED aquarium
        if 'camera_settings' in config:
            apply_camera_settings(picam2, config['camera_settings'])

        logging.info("Camera Module v3 initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize camera: {e}")
        sys.exit(1)
    
    # Main capture loop
    capture_count = 0
    skip_count = 0
    last_cleanup = datetime.now()
    
    try:
        while not shutdown_flag:
            # Check if we're within capture window
            within_window = is_within_capture_window(config)
            should_capture = within_window
            
            if not within_window:
                logging.debug("Skipping capture - outside capture window")
                skip_count += 1
            elif config['lights_only_mode']:
                # Secondary check: lights on/off
                lights_on = check_light_level(picam2, config['light_threshold'])
                should_capture = lights_on
                
                if not lights_on:
                    logging.debug("Skipping capture - lights are off")
                    skip_count += 1
            
            if should_capture:
                # Generate filename with timestamp
                now = datetime.now()
                date_str = now.strftime("%Y-%m-%d")
                time_str = now.strftime("%Y%m%d_%H%M%S")
                
                # Create date-based subdirectory
                output_dir = os.path.join(config['storage_path'], date_str)
                output_path = os.path.join(output_dir, f"{time_str}.jpg")
                
                # Capture image
                if capture_image(picam2, output_path, config['image_quality']):
                    capture_count += 1
            
            # Cleanup old images once per day
            if (datetime.now() - last_cleanup).days >= 1:
                cleanup_old_images(config['storage_path'], config['keep_days'])
                last_cleanup = datetime.now()
                logging.info(f"Statistics - Captured: {capture_count}, Skipped: {skip_count}")
            
            # Wait for next interval
            time.sleep(config['capture_interval_seconds'])
    
    except Exception as e:
        logging.error(f"Error in main loop: {e}", exc_info=True)
    
    finally:
        # Cleanup
        logging.info("Shutting down...")
        logging.info(f"Final statistics - Captured: {capture_count}, Skipped: {skip_count}")
        picam2.stop()
        logging.info("Camera stopped. Goodbye!")

if __name__ == "__main__":
    main()

