#!/usr/bin/env python3
"""
Multi-engine TTS with lightweight emotion detection.

Engines:
- edge: Microsoft neural voices via edge-tts
- qwen: local Qwen3-TTS

Usage:
  python tts.py <text> <output_path> [male|female] [engine] [language_profile]
"""

import asyncio
import os
import re
import sys

EMOTION_PATTERNS = {
    "excited": [
        r"\b(amazing|incredible|awesome|fantastic|wow|great|brilliant|excellent|perfect|love)\b",
        r"[!]{1,}",
        r"\b(can't wait|let's go|yes|absolutely)\b",
    ],
    "sad": [
        r"\b(sorry|unfortunately|sadly|regret|apolog|bad news|failed|broken|error|wrong)\b",
        r"\b(can't|cannot|impossible|unable|fail)\b",
    ],
    "empathetic": [
        r"\b(understand|feel|difficult|hard|challenging|struggle|concern|help|support|together)\b",
        r"\b(i'm here|don't worry|it's okay|you're right)\b",
    ],
    "professional": [
        r"\b(analysis|conclusion|therefore|result|solution|recommend|suggest|implement|configure)\b",
        r"\b(step \d|first|second|third|finally|furthermore|however)\b",
    ],
    "happy": [
        r"\b(good|great|nice|well done|correct|exactly|sure|of course|certainly|absolutely)\b",
        r"\b(here (is|are)|let me|i'll|happy to)\b",
    ],
}

EDGE_VOICES = {
    "female": os.environ.get("EDGE_TTS_FEMALE_VOICE", "en-US-JennyNeural"),
    "male": os.environ.get("EDGE_TTS_MALE_VOICE", "en-US-GuyNeural"),
}

INDIAN_EDGE_VOICES = {
    "hi": {
        "female": os.environ.get("EDGE_TTS_HI_FEMALE_VOICE", "hi-IN-SwaraNeural"),
        "male": os.environ.get("EDGE_TTS_HI_MALE_VOICE", "hi-IN-MadhurNeural"),
    },
    "en_in": {
        "female": os.environ.get("EDGE_TTS_EN_IN_FEMALE_VOICE", "en-IN-NeerjaExpressiveNeural"),
        "male": os.environ.get("EDGE_TTS_EN_IN_MALE_VOICE", "en-IN-PrabhatNeural"),
    },
}

EDGE_PROSODY = {
    "excited": {"rate": "+18%", "pitch": "+6Hz", "volume": "+8%"},
    "happy": {"rate": "+8%", "pitch": "+2Hz", "volume": "+4%"},
    "sad": {"rate": "-14%", "pitch": "-4Hz", "volume": "-4%"},
    "empathetic": {"rate": "-8%", "pitch": "-2Hz", "volume": "+2%"},
    "professional": {"rate": "-2%", "pitch": "+0Hz", "volume": "+0%"},
    "neutral": {"rate": "+0%", "pitch": "+0Hz", "volume": "+0%"},
}


def detect_emotion(text: str) -> str:
    text_lower = text.lower()
    scores = {emotion: 0 for emotion in EMOTION_PATTERNS}

    for emotion, patterns in EMOTION_PATTERNS.items():
        for pattern in patterns:
            scores[emotion] += len(re.findall(pattern, text_lower))

    best = max(scores.keys(), key=lambda key: scores[key])
    return best if scores[best] > 0 else "neutral"


def detect_language_profile(text: str) -> str:
    devanagari_chars = len(re.findall(r"[\u0900-\u097F]", text))
    latin_chars = len(re.findall(r"[A-Za-z]", text))

    if devanagari_chars >= 3 and devanagari_chars >= latin_chars:
        return "hi"

    hindi_roman_markers = [
        "kya", "kaise", "kyun", "haan", "nahi", "acha", "accha", "yaar", "mera",
        "meri", "bhai", "aap", "tum", "samajh", "kr", "kar", "hai", "hain", "tha",
        "thi", "matlab", "jaldi", "thoda", "bahut", "namaste", "dhanyavaad"
    ]
    lowered = text.lower()
    marker_hits = sum(1 for marker in hindi_roman_markers if re.search(rf"\b{re.escape(marker)}\b", lowered))

    if marker_hits >= 2:
        return "en_in"

    return "default"


def select_edge_voice(gender: str, language_profile: str) -> str:
    if language_profile == "hi":
        return INDIAN_EDGE_VOICES["hi"]["female" if gender == "female" else "male"]
    if language_profile == "en_in":
        return INDIAN_EDGE_VOICES["en_in"]["female" if gender == "female" else "male"]
    return EDGE_VOICES["female" if gender == "female" else "male"]


def build_qwen_instruction(emotion: str, gender: str = "male") -> str:
    persona = "male voice, deep and clear" if gender == "male" else "female voice, warm and clear"
    instructions = {
        "excited": f"Speak with energy and enthusiasm, {persona}, upbeat tempo, expressive highs.",
        "sad": f"Speak with a soft, gentle, slightly slower tone, {persona}, empathetic and sincere.",
        "empathetic": f"Speak warmly and supportively, {persona}, calm and reassuring pacing.",
        "professional": f"Speak in a clear, measured, confident tone, {persona}, moderate pace, authoritative.",
        "happy": f"Speak with a bright, friendly, positive tone, {persona}, natural conversational pace.",
        "neutral": f"Speak naturally and clearly, {persona}, balanced and articulate.",
    }
    return instructions.get(emotion, instructions["neutral"])


async def generate_edge_tts(text: str, output_path: str, gender: str, emotion: str, language_profile: str = "") -> None:
    try:
        import edge_tts
    except ImportError:
        print("ERROR: edge-tts not installed. Run: pip install edge-tts", file=sys.stderr)
        sys.exit(2)

    language_profile = language_profile or detect_language_profile(text)
    voice = select_edge_voice(gender, language_profile)
    prosody = EDGE_PROSODY.get(emotion, EDGE_PROSODY["neutral"])

    print(
        f"[Edge-TTS] Emotion: {emotion} | Language: {language_profile} | Voice: {voice} | "
        f"rate={prosody['rate']} pitch={prosody['pitch']} volume={prosody['volume']}"
    )

    communicator = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate=prosody["rate"],
        pitch=prosody["pitch"],
        volume=prosody["volume"],
    )
    await communicator.save(output_path)


def generate_qwen_tts(text: str, output_path: str, gender: str, emotion: str) -> None:
    try:
        import torch
        import soundfile as sf
        from qwen_tts import QwenTTS
    except ImportError as exc:
        print(f"ERROR: missing Qwen dependency: {exc}", file=sys.stderr)
        sys.exit(2)

    instruction = build_qwen_instruction(emotion, gender)
    print(f"[Qwen-TTS] Emotion: {emotion} | Instruction: {instruction[:60]}...")

    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model_name = os.environ.get("QWEN_TTS_MODEL", "Qwen/Qwen3-TTS-0.6B")
        tts = QwenTTS(model_name=model_name, device=device)
        output = tts.generate(text=text, instruction=instruction)

        if isinstance(output, tuple):
            audio_data, sample_rate = output[0], output[1]
        elif isinstance(output, dict):
            audio_data = output.get("audio", output.get("wav"))
            sample_rate = output.get("sample_rate", 24000)
        else:
            audio_data = output
            sample_rate = 24000

        sf.write(output_path, audio_data, sample_rate)
    except Exception as exc:
        print(f"ERROR:{str(exc)}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python tts.py <text> <output_path> [male|female] [engine] [language_profile]")
        sys.exit(1)

    input_text = sys.argv[1]
    output_file = sys.argv[2]
    voice_pref = sys.argv[3] if len(sys.argv) > 3 else "male"
    engine = sys.argv[4] if len(sys.argv) > 4 else "edge"
    language_profile = sys.argv[5] if len(sys.argv) > 5 else ""
    emotion = detect_emotion(input_text)

    if engine == "edge":
        asyncio.run(generate_edge_tts(input_text, output_file, voice_pref, emotion, language_profile))
    elif engine == "qwen":
        generate_qwen_tts(input_text, output_file, voice_pref, emotion)
    else:
        print(f"ERROR: unsupported engine '{engine}'", file=sys.stderr)
        sys.exit(1)

    print(f"COMPLETE:{output_file}")


if __name__ == "__main__":
    main()
