from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .errors import WeatherError
from .routes import router

app = FastAPI(title="Weather Bot", version="1.0.0")

@app.exception_handler(WeatherError)
async def handle_weather_error(request, error):
    return JSONResponse(
        status_code=error.status,
        content={"detail": str(error)},
        headers={"X-Error-Path": request.url.path},
    )

app.include_router(router)
