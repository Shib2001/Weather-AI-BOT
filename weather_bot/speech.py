import io
import json
import os
import sys
import urllib.error
import urllib.request
import wave

from .config import OPENROUTER_TTS_URL
from .errors import WeatherError

def create_speech(text):
    api_key = os.getenv("OPEN_ROUTER") or os.getenv("OPENROUTER_API_KEY")
    if not api_key or api_key == "your_openrouter_api_key_here":
        raise WeatherError(
            "OpenRouter isn't configured. Add your key as OPEN_ROUTER in the project .env file.",
            status=503,
        )

    model = os.getenv(
        "OPENROUTER_TTS_MODEL",
        "heygen/heygen-voice-1-turbo:free",
    )
    payload = {
        "model": model,
        "input": text,
        "response_format": "pcm",
    }
    voice = os.getenv("OPENROUTER_TTS_VOICE")
    if voice:
        payload["voice"] = voice
    elif model.startswith("heygen/"):
        payload["voice"] = "nadine"

    try:
        request = urllib.request.Request(
            OPENROUTER_TTS_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost",
                "X-OpenRouter-Title": "Weather Bot",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            audio = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        print(f"OpenRouter TTS HTTP {error.code}: {detail}", file=sys.stderr)
        try:
            provider_error = json.loads(detail).get("error", {}).get("message")
        except json.JSONDecodeError:
            provider_error = None
        message = (
            f"OpenRouter could not generate speech: {provider_error}"
            if provider_error
            else "OpenRouter could not generate speech."
        )
        raise WeatherError(message, status=502) from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise WeatherError(
            "Could not connect to OpenRouter to generate speech."
        ) from error

    if not audio:
        raise WeatherError("OpenRouter returned empty speech audio.")
    if model.startswith("heygen/"):
        if len(audio) % 2:
            raise WeatherError("HeyGen returned invalid 16-bit PCM audio.")
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(44100)
            wav_file.writeframes(audio)
        return wav_buffer.getvalue(), "audio/wav"
    return audio, "audio/pcm"
