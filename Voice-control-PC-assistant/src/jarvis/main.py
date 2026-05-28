import sys
import os

# Add src to python path to allow imports from jarvis
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from jarvis.engine import JarvisEngine
from jarvis.utils.logger import logger

def main():
    try:
        engine = JarvisEngine()
        engine.initialize()
        engine.run()
    except Exception as e:
        logger.critical(f"Failed to start Jarvis: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
