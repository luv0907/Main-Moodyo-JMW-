"""
openrouter_provider.py
───────────────────────
LLM Provider: OpenRouter with confirmed working free models.
Primary: liquid/lfm-2.5-1.2b-instruct:free (user-confirmed alive)
Falls back through a chain of free models automatically.
"""
import requests
import time
import base64
import os
from jarvis.config import settings
from jarvis.utils.logger import logger
from jarvis.modules.base import BaseLLMProvider

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Confirmed working model first, then fallbacks
FREE_MODELS = [
    'liquid/lfm-2.5-1.2b-instruct:free',       # General purpose (fastest)
    'nvidia/nemotron-nano-12b-v2-vl:free',       # Best for Vision/VL
    'meta-llama/llama-3.3-70b-instruct:free',   # Best for Logic
    'liquid/lfm-2.5-1.2b-thinking:free',       # Fast thinking
    'mistralai/mistral-7b-instruct:free'       # Reliable fallback
]


class OpenRouterProvider(BaseLLMProvider):
    """
    Multi-model fallback LLM provider over OpenRouter's free tier.
    Caches the first working model for speed on all future calls.
    """

    def __init__(self):
        self._working_model: str | None = None

    def initialize(self) -> None:
        logger.info(
            f"Initializing OpenRouter Provider — primary: liquid/lfm-2.5-1.2b-instruct:free"
        )
        if not settings.OPENROUTER_API_KEY:
            logger.error("OPENROUTER_API_KEY is missing in config!")

    def query(self, prompt: str, image_path: str | None = None) -> dict:
        models_to_try = (
            [self._working_model] + [m for m in FREE_MODELS if m != self._working_model]
            if self._working_model
            else FREE_MODELS
        )

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Jarvis-PC-Agent",
            "Content-Type": "application/json",
        }

        for model in models_to_try:
            logger.info(f"🧠 JARVIS Thinking with model: {model}...")
            
            # Prepare message content (Text or Multi-modal)
            if image_path and os.path.exists(image_path):
                with open(image_path, "rb") as f:
                    img_b64 = base64.b64encode(f.read()).decode("utf-8")
                
                content = [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                ]
            else:
                content = prompt

            payload = {
                "model": model,
                "messages": [
                    {"role": "user", "content": content},
                ],
                "temperature": 0.1,
                "max_tokens": 500,
            }

            try:
                resp = requests.post(
                    OPENROUTER_URL, headers=headers, json=payload, timeout=30
                )

                if resp.status_code == 404:
                    logger.warning(f"❌ Model {model} not found (404).")
                    continue

                if resp.status_code == 429:
                    logger.warning(f"⏳ Model {model} rate limited (429). Waiting 2s to retry...")
                    time.sleep(2)
                    # Retry once before moving on
                    resp = requests.post(
                        OPENROUTER_URL, headers=headers, json=payload, timeout=30
                    )
                    if not resp.ok:
                        continue

                if not resp.ok:
                    logger.error(f"⚠️ Model {model} failed with status {resp.status_code}: {resp.text}")
                    continue

                data = resp.json()
                result_text = (
                    data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                )

                if not result_text:
                    logger.warning(f"Empty response from {model}")
                    continue

                if self._working_model != model:
                    logger.info(f"✅ Connection Stable! Locked model: {model}")
                    self._working_model = model

                return {"response": result_text}

            except requests.exceptions.Timeout:
                logger.warning(f"🕒 Model {model} timed out (30s).")
                continue
            except Exception as e:
                logger.error(f"🚨 Critical error with {model}: {e}")
                continue

        logger.error("All models exhausted.")
        return {"error": "All models failed"}
