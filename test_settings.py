#!/usr/bin/env python3
from picamera2 import Picamera2
from libcamera import Transform
import time

picam2 = Picamera2()

config = picam2.create_still_configuration(
    main={"size": (3280, 2464)},
    transform=Transform(rotation=-90)
)
picam2.configure(config)
picam2.start()

# Test different exposure values
test_settings = [
    {"ExposureValue": -0.8, "name": "darker"},
    {"ExposureValue": -0.5, "name": "slightly_darker"},
    {"ExposureValue": -0.3, "name": "normal"},
    {"ExposureValue": 0.0, "name": "default"},
]

for settings in test_settings:
    print(f"Testing: {settings['name']}")
    
    picam2.set_controls({
        "ExposureValue": settings["ExposureValue"],
        "Contrast": 1.2,
        "Sharpness": 1.5
    })
    
    time.sleep(2)
    picam2.capture_file(f"test_{settings['name']}.jpg")
    print(f"Saved test_{settings['name']}.jpg")

picam2.stop()
print("Done! Check which exposure looks best")
