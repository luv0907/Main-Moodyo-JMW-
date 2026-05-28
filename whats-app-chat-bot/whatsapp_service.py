import logging
import requests
from config import NODE_PORT

logger = logging.getLogger(__name__)

NODE_SEND_URL = f"http://localhost:{NODE_PORT}/api/send"

def send_reply(sender: str, message: str) -> bool:
    try:
        response = requests.post(
            NODE_SEND_URL,
            json={"to": sender, "message": message},
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"[SEND] Reply delivered to Ghost Engine for {sender}.")
        return True
    except requests.exceptions.ConnectionError:
        logger.error("[SEND] Cannot reach Ghost Engine. Is Node.js running on port 3001?")
    except requests.exceptions.Timeout:
        logger.error("[SEND] Ghost Engine timed out.")
    except Exception as e:
        logger.error(f"[SEND] Unexpected error: {e}")
    return False
