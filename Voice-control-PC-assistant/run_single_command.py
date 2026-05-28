import sys
import os
import whisper

# Add src to python path to allow imports from jarvis
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from jarvis.engine import JarvisEngine
from jarvis.utils.logger import logger

def main():
    if len(sys.argv) < 2:
        print("Error: Provide audio file path")
        sys.exit(1)

    audio_path = sys.argv[1]
    
    try:
        # 1. Transcribe the audio using whisper base model
        model = whisper.load_model("base")
        result = model.transcribe(audio_path)
        text = result["text"].strip()
        print(f"Transcribed: {text}")

        if not text:
            print("No command detected.")
            sys.exit(0)

        # 2. Process with Jarvis Engine
        engine = JarvisEngine()
        engine.initialize()
        
        # We need a way to capture the TTS / responses for the web UI.
        # But for now, let's just let it run its process_goal.
        # We can hook into _ui_emit
        response_texts = []
        def my_ui_emit(event_type, kwargs):
            if event_type == "jarvis_message":
                response_texts.append(kwargs.get("text", ""))

        from jarvis.engine import set_ui_emit
        set_ui_emit(my_ui_emit)

        engine.process_goal(text)

        # Write the responses to stdout for the node server to read
        print(f"JARVIS_RESPONSE:{' '.join(response_texts)}")

    except Exception as e:
        logger.critical(f"Failed to process command: {e}")
        print(f"JARVIS_RESPONSE:Error processing command: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
