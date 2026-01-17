#!/usr/bin/env python3
from picamera2 import Picamera2
from libcamera import Transform
import time

picam2 = Picamera2()

config = picam2.create_still_configuration(
    main={"size": (1920, 1080)},
    transform=Transform(rotation=-90)
)
picam2.configure(config)
picam2.start()

# Try different focus settings
focus_positions = [0.5, 1.0, 1.5, 2.0, 3.0]

for pos in focus_positions:
    print(f"Testing focus position: {pos}")
    
    picam2.set_controls({
        "AfMode": 0,  # Manual
        "LensPosition": pos,
        "ExposureValue": -0.3
    })
    
    time.sleep(2)
    picam2.capture_file(f"test_focus_{pos}.jpg")
    print(f"Saved test_focus_{pos}.jpg")

picam2.stop()
print("Done! Check the images to find best focus position")
