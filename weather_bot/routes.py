import json
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response

from .cache import get_cached_json, get_cached_speech, make_cache_key, set_cached_json, set_cached_speech
from .config import APP_DIR, ERROR_CACHE_TTL, GREETING_CACHE_TTL, SPEECH_CACHE_TTL
from .errors import WeatherError
from .reports import create_cached_weather_report
from .schemas import SpeechRequest, WeatherRequest
from .speech import create_speech
from .weather import fetch_weather, greeting_response, is_unrelated_question, normalize_place_name

router = APIRouter()

@router.get("/", include_in_schema=False)
def index():
    return FileResponse(APP_DIR / "index.html")

@router.get("/style.css", include_in_schema=False)
def stylesheet():
    return FileResponse(APP_DIR / "style.css", media_type="text/css")

@router.get("/favicon.svg", include_in_schema=False)
def favicon():
    return FileResponse(APP_DIR / "favicon.svg", media_type="image/svg+xml")

@router.get("/favicon.ico", include_in_schema=False)
def legacy_favicon():
    return RedirectResponse("/favicon.svg")

@router.get("/backgrounds/{image_name}", include_in_schema=False)
def background_image(image_name: str):
    if image_name not in {f"Weather_bot_{index}.jpg" for index in range(5)}:
        raise HTTPException(status_code=404, detail="Background image not found.")
    return FileResponse(APP_DIR / image_name, media_type="image/jpeg")

@router.get("/script.js", include_in_schema=False)
def javascript():
    return FileResponse(APP_DIR / "script.js", media_type="text/javascript")

@router.post("/api/weather")
def weather_endpoint(request: WeatherRequest):
    query = request.query or request.city or ""
    error_key = make_cache_key("error", normalize_place_name(query))
    cached_error = get_cached_json(error_key)
    if isinstance(cached_error, dict) and cached_error.get("status") in {400, 422}:
        raise WeatherError(cached_error["detail"], status=cached_error["status"])

    greeting = greeting_response(query)
    if greeting:
        return {"type": "greeting", "message": greeting}
    if is_unrelated_question(query):
        message = (
            "I can only help with weather questions. Try asking about the weather "
            "in a city."
        )
        set_cached_json(
            error_key,
            {"detail": message, "status": 422},
            ERROR_CACHE_TTL,
        )
        raise WeatherError(message, status=422)

    try:
        weather = fetch_weather(query)
    except WeatherError as error:
        if error.status in {400, 422}:
            set_cached_json(
                error_key,
                {"detail": str(error), "status": error.status},
                ERROR_CACHE_TTL,
            )
        raise

    report, cache_status = create_cached_weather_report(weather)
    return JSONResponse(
        content={"weather": weather, "report": report},
        headers={"X-Report-Cache": cache_status},
    )

@router.post("/api/greeting")
def greeting_endpoint(request: WeatherRequest):
    query = request.query or request.city or ""
    greeting = greeting_response(query)
    if not greeting:
        raise WeatherError("Enter a greeting such as “Hello” or “Good morning.”", status=400)

    cache_key = make_cache_key("greeting", greeting)
    cached_greeting = get_cached_json(cache_key)
    if isinstance(cached_greeting, str):
        greeting = cached_greeting
        cache_status = "HIT"
    else:
        set_cached_json(cache_key, greeting, GREETING_CACHE_TTL)
        cache_status = "MISS"
    return JSONResponse(
        content={"type": "greeting", "message": greeting},
        headers={"X-Response-Cache": cache_status},
    )

@router.post("/api/speech")
def speech_endpoint(request: SpeechRequest):
    model = os.getenv(
        "OPENROUTER_TTS_MODEL",
        "heygen/heygen-voice-1-turbo:free",
    )
    voice = os.getenv("OPENROUTER_TTS_VOICE")
    if not voice and model.startswith("heygen/"):
        voice = "nadine"
    cache_key = make_cache_key(
        "speech",
        json.dumps(
            {
                "model": model,
                "voice": voice,
                "format": "pcm",
                "text": request.text,
            },
            sort_keys=True,
            ensure_ascii=False,
        ),
    )
    cached_speech = get_cached_speech(cache_key)
    if cached_speech is not None:
        audio, media_type = cached_speech
        cache_status = "HIT"
    else:
        audio, media_type = create_speech(request.text)
        set_cached_speech(cache_key, audio, media_type, SPEECH_CACHE_TTL)
        cache_status = "MISS"
    return Response(
        content=audio,
        media_type=media_type,
        headers={
            "Cache-Control": "no-store",
            "X-Speech-Cache": cache_status,
        },
    )

