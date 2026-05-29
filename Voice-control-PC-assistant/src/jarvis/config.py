import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # LLM Settings
    LLM_PROVIDER: str = "openrouter"
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "llama3.2-vision:11b-instruct-q4_K_M"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1/chat/completions"
    OPENROUTER_MODEL: str = "google/gemini-2.5-flash"

    # STT Settings
    STT_MODEL: str = "medium"
    SAMPLERATE: int = 16000
    AUDIO_CHANNELS: int = 1
    STT_DEVICE: Optional[int] = None

    # TTS Settings — macOS native voice
    TTS_USE_MACOS: bool = True          # True = use macOS 'say', False = pyttsx3
    TTS_VOICE: str = "Samantha"         # macOS voice: Samantha, Karen, Daniel, Isha
    TTS_RATE: int = 185                 # Words per minute (for 'say' command)
    TTS_VOLUME: float = 1.0             # pyttsx3 fallback only

    # Wake Word Settings
    WAKE_WORD_ENABLED: bool = True      # Hands-free "Hey JARVIS" mode
    WAKE_WORDS: list = ["jarvis", "hey jarvis", "hey, jarvis", "okay jarvis"]
    PORCUPINE_ACCESS_KEY: str = ""      # Optional: get free key at console.picovoice.ai

    # Behaviour Settings
    CONFIRM_RISKY_ACTIONS: bool = True  # Ask "shall I go ahead?" for email/sleep/delete
    USER_NAME: str = "Boss"
    DEFAULT_BROWSER: str = "Google Chrome"
    DESKTOP_PATH: str = os.path.expanduser("~/Desktop")

    # Memory Settings
    MEMORY_FILE: str = "jarvis_memory.json"
    MEMORY_LIMIT: int = 100

    # Vision Settings
    SCREENSHOT_PATH: str = "screen.jpg"

    # Agent Settings
    MAX_ATTEMPTS: int = 5

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()

