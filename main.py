import os

import uvicorn

from weather_bot.app import app


def main():
    host = os.getenv("WEATHER_BOT_HOST", "127.0.0.1")
    port = int(os.getenv("WEATHER_BOT_PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
