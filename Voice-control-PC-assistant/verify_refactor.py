import sys
import os

# Add src to python path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from jarvis.config import settings
from jarvis.utils.logger import logger
from jarvis.engine import JarvisEngine

def test_config():
    logger.info("Testing configuration...")
    assert settings.LLM_PROVIDER == "ollama"
    logger.info("Config test passed.")

def test_engine_init():
    logger.info("Testing engine initialization...")
    # Mocking modules that might require hardware/external services if needed
    # For now, let's just try to instantiate
    engine = JarvisEngine()
    assert engine.stt is not None
    assert engine.tts is not None
    assert engine.memory is not None
    assert engine.llm is not None
    logger.info("Engine instantiation passed.")

if __name__ == "__main__":
    try:
        test_config()
        test_engine_init()
        logger.info("All basic architectural tests passed!")
    except Exception as e:
        logger.error(f"Test failed: {e}")
        sys.exit(1)
