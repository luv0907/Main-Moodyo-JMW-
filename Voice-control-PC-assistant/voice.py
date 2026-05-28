model = whisper.load_model("base")

def listen():
    audio = sd.rec(int(4 * samplerate), samplerate=samplerate, channels=1)
    sd.wait()

    wav.write("temp.wav", samplerate, audio)
    result = model.transcribe("temp.wav")
    return result["text"].strip()
