from pydantic import BaseModel, Field

class WeatherRequest(BaseModel):
    query: str | None = Field(default=None, min_length=1, max_length=200)
    city: str | None = Field(default=None, min_length=1, max_length=100)

class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
