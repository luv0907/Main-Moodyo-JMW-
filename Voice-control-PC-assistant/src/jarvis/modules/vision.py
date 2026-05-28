import pyautogui
from jarvis.config import settings
from jarvis.utils.logger import logger
import os
from PIL import Image

class VisionModule:
    def take_screenshot(self) -> str:
        """Takes a screenshot, resizes it for LLM, and returns the path."""
        path = settings.SCREENSHOT_PATH
        logger.info(f"📸 Capturing screen state...")
        
        # Take full screenshot
        screenshot = pyautogui.screenshot().convert("RGB")
        
        # Resize for LLM (max 1024 width while maintaining aspect ratio)
        max_size = (1024, 1024)
        screenshot.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save as JPEG (smaller than PNG)
        screenshot.save(path, "JPEG", quality=85)
        
        return os.path.abspath(path)