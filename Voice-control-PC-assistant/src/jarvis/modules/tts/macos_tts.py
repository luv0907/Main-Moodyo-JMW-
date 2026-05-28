"""
macOS native TTS using the built-in `say` command.
Uses the same neural voices as Siri — much more natural than pyttsx3.
"""
import subprocess
from jarvis.modules.base import BaseTTS
from jarvis.config import settings
from jarvis.utils.logger import logger


class MacOSTTS(BaseTTS):
    def initialize(self) -> None:
        logger.info(f"Initializing macOS TTS — Voice: {settings.TTS_VOICE}, Rate: {settings.TTS_RATE}")

    def speak(self, text: str) -> None:
        if not text or not text.strip():
            return
        logger.info(f"Speaking: {text}")
        # -v = voice name, -r = words per minute
        subprocess.run(
            ["say", "-v", settings.TTS_VOICE, "-r", str(settings.TTS_RATE), text],
            check=False
        )
