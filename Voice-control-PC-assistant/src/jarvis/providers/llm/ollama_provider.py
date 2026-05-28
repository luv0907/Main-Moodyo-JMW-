import requests
from jarvis.modules.base import BaseLLMProvider
from jarvis.config import settings
from jarvis.utils.logger import logger

class OllamaProvider(BaseLLMProvider):
    def initialize(self) -> None:
        logger.info(f"Initializing Ollama Provider at {settings.OLLAMA_BASE_URL} model: {settings.OLLAMA_MODEL}")
        # Could add a health check here

    def query(self, prompt: str) -> dict:
        logger.debug(f"Querying Ollama with prompt: {prompt[:100]}...")
        try:
            response = requests.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=120
            )
            
            if response.status_code != 200:
                logger.error(f"Ollama Error ({response.status_code}): {response.text}")
                return {"error": response.text}
            
            return response.json()
        except Exception as e:
            logger.error(f"Ollama exception: {e}")
            return {"error": str(e)}
