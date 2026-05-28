import os
import logging

# ─── NVIDIA AI ───────────────────────────────────────────────────────────────
NVIDIA_API_KEY  = os.getenv("OPENROUTER_API_KEY", "")
NVIDIA_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL           = "nvidia/nemotron-3-nano-30b-a3b:free"

NODE_PORT  = 3001
FLASK_PORT = 5001

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%H:%M:%S"
    )