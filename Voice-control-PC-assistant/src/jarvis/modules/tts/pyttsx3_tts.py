import pyttsx3
from jarvis.modules.base import BaseTTS
from jarvis.config import settings
from jarvis.utils.logger import logger

class Pyttsx3TTS(BaseTTS):
    def __init__(self):
        self.engine = None

    def initialize(self) -> None:
        logger.info("Initializing pyttsx3 TTS")
        self.engine = pyttsx3.init()
        self.engine.setProperty("rate", settings.TTS_RATE)
        self.engine.setProperty("volume", settings.TTS_VOLUME)

    def speak(self, text: str) -> None:
        logger.info(f"Speaking: {text}")
        self.engine.say(text)
        self.engine.runAndWait()
