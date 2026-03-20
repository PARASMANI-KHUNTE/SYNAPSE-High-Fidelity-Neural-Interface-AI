import asyncio
import sys
import os
import edge_tts

async def generate_speech(text, output_path, voice="en-US-GuyNeural"):
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        print(f"COMPLETE:{output_path}")
    except Exception as e:
        print(f"ERROR:{str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python tts.py <text> <output_path> [voice]")
        sys.exit(1)
    
    text = sys.argv[1]
    output_path = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "en-US-GuyNeural"
    
    asyncio.run(generate_speech(text, output_path, voice))
