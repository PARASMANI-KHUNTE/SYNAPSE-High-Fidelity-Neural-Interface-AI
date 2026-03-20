import sys
import os
from faster_whisper import WhisperModel

# Prevent logging clutter
import logging
logging.basicConfig()
logging.getLogger("faster_whisper").setLevel(logging.ERROR)

def transcribe(audio_path):
    try:
        model_size = "base.en"
        # Run on CPU by default for maximum compatibility
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        
        segments, info = model.transcribe(audio_path, beam_size=5)
        
        text = ""
        for segment in segments:
            text += segment.text
            
        print(text.strip())
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <path_to_audio>")
        sys.exit(1)
    
    transcribe(sys.argv[1])
