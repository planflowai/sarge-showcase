"""
XTTS-v2 TTS Server for Sarge's Workbench
Provides custom voice synthesis using speaker reference WAVs.

Usage:
  pip install -r requirements.txt
  python app.py

Requires: ffmpeg installed on system (for M4A → WAV conversion)

Speakers folder should contain:
  jarvis 1.wav, jarvis 2.wav, jarvis 3.wav  (multi-reference)
  Friday.m4a                                 (auto-converted to friday.wav on startup)
"""

import io
import wave
import struct
import subprocess
import shutil
from pathlib import Path

import torch
from TTS.api import TTS
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="XTTS-v2 TTS Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve speakers directory — check tts-server/speakers first, then public/speakers
SCRIPT_DIR = Path(__file__).parent
SPEAKERS_DIR = SCRIPT_DIR / "speakers"
if not SPEAKERS_DIR.exists():
    SPEAKERS_DIR = SCRIPT_DIR.parent / "public" / "speakers"

# Speaker configurations: name → list of WAV files
SPEAKERS: dict[str, list[str]] = {}

device = "cuda" if torch.cuda.is_available() else "cpu"
tts_model: TTS | None = None


def convert_m4a_to_wav(m4a_path: Path, wav_path: Path) -> bool:
    """Convert M4A to WAV using ffmpeg. Returns True on success."""
    if not shutil.which("ffmpeg"):
        print(f"WARNING: ffmpeg not found — cannot convert {m4a_path.name}")
        print("  Install ffmpeg: https://ffmpeg.org/download.html")
        return False
    try:
        subprocess.run(
            ["ffmpeg", "-i", str(m4a_path), "-ar", "22050", "-ac", "1",
             "-sample_fmt", "s16", str(wav_path), "-y"],
            check=True, capture_output=True,
        )
        print(f"  Converted {m4a_path.name} → {wav_path.name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ERROR converting {m4a_path.name}: {e.stderr.decode()[:200]}")
        return False


def discover_speakers():
    """Scan speakers directory and build speaker config."""
    SPEAKERS.clear()
    if not SPEAKERS_DIR.exists():
        return

    # Jarvis: multi-reference — match "jarvis 1.wav" or "jarvis_1.wav"
    jarvis_files = sorted(
        list(SPEAKERS_DIR.glob("jarvis_*.wav")) +
        list(SPEAKERS_DIR.glob("jarvis *.wav"))
    )
    if jarvis_files:
        SPEAKERS["jarvis"] = [str(f) for f in jarvis_files]

    # Friday: auto-convert M4A if needed
    friday_wav = SPEAKERS_DIR / "friday.wav"
    friday_m4a = next(SPEAKERS_DIR.glob("Friday.m4a"), None) or next(SPEAKERS_DIR.glob("friday.m4a"), None)

    if not friday_wav.exists() and friday_m4a:
        convert_m4a_to_wav(friday_m4a, friday_wav)

    if friday_wav.exists():
        SPEAKERS["friday"] = [str(friday_wav)]

    # Auto-discover any other .wav files as single-reference speakers
    for wav in SPEAKERS_DIR.glob("*.wav"):
        name = wav.stem.lower()
        if name.startswith("jarvis") or name == "friday" or name == "readme":
            continue
        if name not in SPEAKERS:
            SPEAKERS[name] = [str(wav)]


def load_model():
    global tts_model
    if tts_model is None:
        print(f"Loading XTTS-v2 on {device}... (first run downloads ~2GB)")
        tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        print("XTTS-v2 loaded.")
    return tts_model


class SynthesizeRequest(BaseModel):
    text: str
    speaker: str = "jarvis"
    language: str = "en"


@app.on_event("startup")
async def startup():
    discover_speakers()
    print(f"Speakers directory: {SPEAKERS_DIR}")
    print(f"Available speakers: {list(SPEAKERS.keys()) if SPEAKERS else 'None (add WAV files to speakers/)'}")
    load_model()


@app.get("/api/speakers")
async def list_speakers():
    """List available speaker voices."""
    return {
        "speakers": list(SPEAKERS.keys()),
        "speakers_dir": str(SPEAKERS_DIR),
    }


@app.post("/api/synthesize")
async def synthesize(req: SynthesizeRequest):
    """Generate speech audio from text using a speaker voice."""
    if not req.text.strip():
        raise HTTPException(400, "Text is required")

    speaker_wavs = SPEAKERS.get(req.speaker.lower())
    if not speaker_wavs:
        raise HTTPException(
            404,
            f"Speaker '{req.speaker}' not found. Available: {list(SPEAKERS.keys())}",
        )

    model = load_model()

    wav_data = model.tts(
        text=req.text,
        speaker_wav=speaker_wavs,
        language=req.language,
    )

    # Convert float samples to 16-bit PCM WAV
    sample_rate = 24000  # XTTS-v2 default output rate
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for sample in wav_data:
            clamped = max(-1.0, min(1.0, sample))
            wf.writeframes(struct.pack("<h", int(clamped * 32767)))

    return Response(
        content=buf.getvalue(),
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"},
    )


@app.get("/health")
async def health():
    return {"status": "ok", "device": device, "speakers": list(SPEAKERS.keys())}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8787)
