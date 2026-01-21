#!/usr/bin/env python3
"""
Centralized Camera Module v3 (IMX708) Configuration Management
Provides shared camera settings logic for capture.py and viewer.py
"""

import json
import time
from pathlib import Path
from typing import Dict, Tuple, Optional

try:
    from picamera2 import Picamera2
    from libcamera import Transform, controls
    HAS_CAMERA = True
except ImportError:
    try:
        from mock_camera import MockPicamera2 as Picamera2, libcamera
        Transform = libcamera.Transform
        controls = libcamera.controls
        HAS_CAMERA = True
        print("Using mock camera for testing")
    except ImportError:
        HAS_CAMERA = False


class CameraConfig:
    """Centralized Camera Module v3 configuration management"""

    @staticmethod
    def apply_settings(picam2: Picamera2, settings: Dict) -> bool:
        """
        Apply optimized camera settings for Camera Module v3 (IMX708) with RGB LED aquarium lighting

        Args:
            picam2: Picamera2 instance
            settings: Dictionary of camera settings from config.json

        Returns:
            bool: True if settings applied successfully, False otherwise
        """
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

            # Metering mode (Camera v3 supports Matrix mode)
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

            # Image processing controls
            if 'sharpness' in settings:
                camera_controls['Sharpness'] = settings['sharpness']
            if 'contrast' in settings:
                camera_controls['Contrast'] = settings['contrast']
            if 'brightness' in settings:
                camera_controls['Brightness'] = settings['brightness']
            if 'saturation' in settings:
                camera_controls['Saturation'] = settings['saturation']

            # Frame duration limits (for consistent exposure with aquarium lighting flicker)
            if 'frame_duration_limits' in settings:
                min_duration = settings['frame_duration_limits'].get('min_us')
                max_duration = settings['frame_duration_limits'].get('max_us')
                if min_duration and max_duration:
                    camera_controls['FrameDurationLimits'] = (min_duration, max_duration)

            picam2.set_controls(camera_controls)
            return True
        except Exception as e:
            print(f"Failed to apply camera settings: {e}")
            return False

    @staticmethod
    def enable_autofocus(picam2: Picamera2) -> bool:
        """
        Enable Camera Module v3 autofocus with continuous AF mode

        Args:
            picam2: Picamera2 instance

        Returns:
            bool: True if autofocus enabled successfully, False otherwise
        """
        try:
            picam2.set_controls({
                "AfMode": controls.AfModeEnum.Continuous,
                "AfSpeed": controls.AfSpeedEnum.Fast
            })
            return True
        except Exception as e:
            print(f"Could not enable autofocus: {e}")
            return False

    @staticmethod
    def create_still_configuration(
        picam2: Picamera2,
        width: int,
        height: int,
        rotation: int = 270,
        hdr_enabled: bool = False
    ) -> Tuple:
        """
        Create optimized still capture configuration for Camera Module v3

        Args:
            picam2: Picamera2 instance
            width: Image width in pixels
            height: Image height in pixels
            rotation: Rotation angle (0, 90, 180, 270)
            hdr_enabled: Enable HDR mode (Camera v3 feature)

        Returns:
            Tuple: (config, should_configure) - configuration dict and whether to call configure()
        """
        if hdr_enabled:
            config = picam2.create_still_configuration(
                main={"size": (width, height)},
                transform=Transform(hflip=0, vflip=0, rotation=rotation),
                controls={"HdrMode": 1}  # Enable HDR
            )
        else:
            config = picam2.create_still_configuration(
                main={"size": (width, height)},
                transform=Transform(hflip=0, vflip=0, rotation=rotation)
            )
        return config

    @staticmethod
    def create_video_configuration(
        picam2: Picamera2,
        width: int = 1280,
        height: int = 960,
        rotation: int = 270,
        hdr_enabled: bool = False
    ) -> Tuple:
        """
        Create optimized video/stream configuration for Camera Module v3

        Args:
            picam2: Picamera2 instance
            width: Video width in pixels (default: 1280 for streaming)
            height: Video height in pixels (default: 960 for streaming)
            rotation: Rotation angle (0, 90, 180, 270)
            hdr_enabled: Enable HDR mode (Camera v3 feature)

        Returns:
            Tuple: (config, should_configure) - configuration dict and whether to call configure()
        """
        if hdr_enabled:
            config = picam2.create_video_configuration(
                main={"size": (width, height)},
                transform=Transform(hflip=0, vflip=0, rotation=rotation),
                controls={"HdrMode": 1}  # Enable HDR
            )
        else:
            config = picam2.create_video_configuration(
                main={"size": (width, height)},
                transform=Transform(hflip=0, vflip=0, rotation=rotation)
            )
        return config

    @staticmethod
    def initialize_camera_for_capture(
        picam2: Picamera2,
        config_dict: Dict,
        logger=None
    ) -> bool:
        """
        Complete camera initialization for still capture with all Camera v3 optimizations

        Args:
            picam2: Picamera2 instance
            config_dict: Full configuration dictionary
            logger: Optional logger instance (uses print if None)

        Returns:
            bool: True if initialization successful, False otherwise
        """
        log = logger.info if logger else print
        log_warn = logger.warning if logger else print

        try:
            # Extract configuration
            width = config_dict['resolution']['width']
            height = config_dict['resolution']['height']
            hdr_enabled = config_dict.get('camera_settings', {}).get('hdr_mode', False)
            camera_settings = config_dict.get('camera_settings', {})

            if hdr_enabled:
                log("HDR mode enabled")

            # Create and apply configuration
            config = CameraConfig.create_still_configuration(
                picam2, width, height, rotation=270, hdr_enabled=hdr_enabled
            )
            picam2.configure(config)
            picam2.start()

            # Enable autofocus
            if CameraConfig.enable_autofocus(picam2):
                log("Autofocus enabled (Camera Module v3)")
            else:
                log_warn("Autofocus not available or failed to enable")

            # Warm-up time
            time.sleep(2)

            # Apply camera settings
            if camera_settings:
                CameraConfig.apply_settings(picam2, camera_settings)
                log("Camera Module v3 settings applied")

            log("Camera Module v3 initialized successfully")
            return True

        except Exception as e:
            log_error = logger.error if logger else print
            log_error(f"Failed to initialize camera: {e}")
            return False

    @staticmethod
    def initialize_camera_for_stream(
        picam2: Picamera2,
        config_path: str,
        logger=None
    ) -> bool:
        """
        Complete camera initialization for video streaming with all Camera v3 optimizations

        Args:
            picam2: Picamera2 instance
            config_path: Path to config.json file
            logger: Optional logger instance (uses print if None)

        Returns:
            bool: True if initialization successful, False otherwise
        """
        log = logger.info if logger else print
        log_warn = logger.warning if logger else print

        try:
            # Load config for HDR and settings
            with open(config_path, 'r') as f:
                config = json.load(f)

            hdr_enabled = config.get('camera_settings', {}).get('hdr_mode', False)
            camera_settings = config.get('camera_settings', {})

            if hdr_enabled:
                log("HDR mode enabled for stream")

            # Create and apply configuration (lower resolution for bandwidth)
            video_config = CameraConfig.create_video_configuration(
                picam2, width=1280, height=960, rotation=270, hdr_enabled=hdr_enabled
            )
            picam2.configure(video_config)
            picam2.start()

            # Enable autofocus
            if CameraConfig.enable_autofocus(picam2):
                log("Camera v3 autofocus enabled for stream")
            else:
                log_warn("Autofocus not available or failed to enable")

            # Brief warm-up
            time.sleep(1)

            # Apply camera settings
            if camera_settings:
                CameraConfig.apply_settings(picam2, camera_settings)
                log("Camera Module v3 stream settings applied")

            return True

        except Exception as e:
            log_error = logger.error if logger else print
            log_error(f"Failed to initialize camera for stream: {e}")
            return False


# Convenience function for loading config
def load_camera_config(config_path: Optional[str] = None) -> Dict:
    """
    Load configuration from JSON file

    Args:
        config_path: Path to config.json (uses default if None)

    Returns:
        Dict: Configuration dictionary
    """
    if config_path is None:
        config_path = Path(__file__).parent / "config.json"

    with open(config_path, 'r') as f:
        return json.load(f)
