from pynput import keyboard
import whisper
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
from jarvis.modules.base import BaseSTT
from jarvis.config import settings
from jarvis.utils.logger import logger
import tempfile
import os
import threading
import queue

class WhisperSTT(BaseSTT):
    def __init__(self):
        self.model = None
        self.recording = False
        self.audio_data = []

    def initialize(self) -> None:
        logger.info(f"Initializing Whisper STT with model: {settings.STT_MODEL}")
        self.model = whisper.load_model(settings.STT_MODEL)

    def listen(self) -> str:
        self.audio_data = []
        self.recording = False
        
        print("\n[ Press SPACE to start recording ]")
        
        # Wait for first SPACE press
        with keyboard.Events() as events:
            for event in events:
                if isinstance(event, keyboard.Events.Press) and event.key == keyboard.Key.space:
                    break
        
        print("[ Recording... Press SPACE again to stop ]")
        self.recording = True
        
        # Start recording in a stream
        def callback(indata, frames, time, status):
            if self.recording:
                self.audio_data.append(indata.copy())

        with sd.InputStream(samplerate=settings.SAMPLERATE, 
                           channels=settings.AUDIO_CHANNELS, 
                           callback=callback):
            # Wait for second SPACE press
            with keyboard.Events() as events:
                for event in events:
                    if isinstance(event, keyboard.Events.Press) and event.key == keyboard.Key.space:
                        break
        
        self.recording = False
        print("[ Processing... ]")
        
        if not self.audio_data:
            return ""

        audio_np = np.concatenate(self.audio_data, axis=0)
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            wav.write(tmp_file.name, settings.SAMPLERATE, audio_np)
            tmp_path = tmp_file.name

        try:
            result = self.model.transcribe(tmp_path, fp16=False)
            text = result["text"].strip()
            if text:
                logger.info(f"Transcribed: {text}")
            return text
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
