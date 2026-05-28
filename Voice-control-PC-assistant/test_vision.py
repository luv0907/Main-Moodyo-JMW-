import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'src'))

from jarvis.modules.vision import VisionModule
from jarvis.config import settings

def test_vision():
    print("Testing Vision Module...")
    vision = VisionModule()
    try:
        path = vision.take_screenshot()
        print(f"✅ Screenshot saved successfully to: {path}")
        if os.path.exists(path):
            print(f"✅ File exists. Size: {os.path.getsize(path)} bytes")
        else:
            print("❌ File does not exist!")
    except Exception as e:
        print(f"❌ Vision test failed: {e}")

if __name__ == "__main__":
    test_vision()
