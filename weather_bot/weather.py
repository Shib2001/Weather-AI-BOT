import datetime
import re
import unicodedata
import urllib.parse

from .cache import make_cache_key
from .clients import request_json
from .config import ARCHIVE_URL, FORECAST_CACHE_TTL, FORECAST_URL, GEOCODING_CACHE_TTL, GEOCODING_URL, HISTORICAL_CACHE_TTL, YESTERDAY_CACHE_TTL
from .errors import WeatherError

def weather_description(code):
    descriptions = {
        0: "clear sky",
        1: "mainly clear",
        2: "partly cloudy",
        3: "overcast",
        45: "fog",
        48: "rime fog",
        51: "light drizzle",
        53: "moderate drizzle",
        55: "dense drizzle",
        56: "light freezing drizzle",
        57: "dense freezing drizzle",
        61: "light rain",
        63: "moderate rain",
        65: "heavy rain",
        66: "light freezing rain",
        67: "heavy freezing rain",
        71: "light snow",
        73: "moderate snow",
        75: "heavy snow",
        77: "snow grains",
        80: "light rain showers",
        81: "moderate rain showers",
        82: "heavy rain showers",
        85: "light snow showers",
        86: "heavy snow showers",
        95: "thunderstorms",
        96: "thunderstorms with light hail",
        99: "thunderstorms with heavy hail",
    }
    return descriptions.get(code, "current conditions")

def greeting_response(query):
    name_match = re.search(
        r"\b(?:my name is|i am|i['’]m|call me)\s+"
        r"([\w][\w'-]{0,30})\b",
        query,
        re.IGNORECASE,
    )
    name = name_match.group(1).strip("'-") if name_match else None
    if name_match:
        query = query[:name_match.start()] + query[name_match.end():]

    normalized = re.sub(r"[^\w\s']", "", query.casefold())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    normalized = re.sub(r"\b(?:and|please)\b", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()

    greeting_pattern = re.compile(
        r"^(?:(?:hello|hi|hey)(?: there)?|"
        r"good (?:morning|afternoon|evening)|"
        r"(?:morning|afternoon|evening)|"
        r"how are you(?: doing)?|how is it going|how['’]s it going|hows it going)"
        r"(?:\s+good (?:morning|afternoon|evening))?"
        r"(?:\s+(?:how are you(?: doing)?|how is it going|"
        r"how['’]s it going|hows it going))?$"
    )
    if not greeting_pattern.fullmatch(normalized):
        return None

    time_greeting = re.search(
        r"\b(?:good )?(morning|afternoon|evening)\b",
        normalized,
    )
    greeting = time_greeting.group(1).capitalize() if time_greeting else None
    time_phrase = f" good {greeting.lower()}" if greeting else ""
    if name:
        display_name = name[:1].upper() + name[1:]
        return (
            f"Hey{time_phrase}! How are you? I’m Astra, your weather assistant. "
            f"How are you, {display_name}?"
        )
    if normalized.startswith("how are you"):
        return (
            "I’m doing well, thank you for asking! I’m Astra, your weather "
            "assistant. What city can I help you with?"
        )
    return (
        f"Hey{time_phrase}! How are you? I’m Astra, your weather assistant. "
        "What city’s weather can I help you with?"
    )

def is_unrelated_question(query):
    return bool(
        QUESTION_START_PATTERN.search(query.strip())
        and not WEATHER_TOPIC_PATTERN.search(query)
    )

def normalize_place_name(value):
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return re.sub(r"\W+", " ", without_accents).strip()

def parse_weather_question(question):
    question = question.strip()
    if not question or len(question) > 200 or any(ord(char) < 32 for char in question):
        raise WeatherError("Enter a city name (up to 100 characters).", status=400)
    if not any(char.isalpha() for char in question) or any(
        not (char.isalpha() or char.isspace() or char in " ,.'’?!-")
        for char in question
    ):
        raise WeatherError(WEATHER_LOCATION_NOT_FOUND, status=422)

    normalized = re.sub(r"\s+", " ", question).strip().rstrip("?!.,")
    lowered = normalized.casefold().replace("’", "'")
    is_rainy_season = any(
        phrase in lowered
        for phrase in ("rainy season", "monsoon season", "monsoon", "rain season")
    )
    if re.search(r"\bday before yesterday\b", lowered):
        period = "day_before_yesterday"
    elif re.search(r"\byesterday\b", lowered):
        period = "yesterday"
    elif re.search(r"\bday after tomorrow\b", lowered):
        period = "day_after_tomorrow"
    elif re.search(r"\btomorrow\b", lowered):
        period = "tomorrow"
    else:
        period = "today"

    condition_patterns = {
        "rain": r"\b(?:rain|rainy|raining|drizzle|showers?|precipitation|wet|monsoon)\b",
        "cloud": r"\b(?:cloud|cloudy|clouds|overcast)\b",
        "sun": r"\b(?:sun|sunny|sunshine|clear)\b",
        "snow": r"\b(?:snow|snowy|sleet)\b",
        "storm": r"\b(?:storm|stormy|thunder|thunderstorm|lightning)\b",
        "fog": r"\b(?:fog|foggy|mist|misty)\b",
        "wind": r"\b(?:wind|windy|breezy|breeze)\b",
        "hot": r"\b(?:hot|warm|heat|heatwave)\b",
        "cold": r"\b(?:cold|cool|chilly|freezing)\b",
    }
    weather_interest = [
        condition
        for condition, pattern in condition_patterns.items()
        if re.search(pattern, lowered)
    ]

    location = re.sub(r"\b(?:what|how)'s\b", " ", lowered)
    location = re.sub(
        r"\bthe\s+(?=(?:day before|day after)\b|yesterday\b|tomorrow\b|today\b)",
        " ",
        location,
    )
    location = re.sub(r"\bday before yesterday\b|\bday after tomorrow\b", " ", location)
    location = re.sub(r"\bthe\s+(?=weather|forecast|conditions?\b)", " ", location)
    location = re.sub(
        r"\b(?:today|tomorrow|yesterday|now|currently|right now)\b",
        " ",
        location,
    )
    location = re.sub(
        "|".join(f"(?:{pattern})" for pattern in condition_patterns.values()),
        " ",
        location,
    )
    location = re.sub(
        r"\b(?:what|whats|is|are|weather|forecast|conditions?|condition|season|"
        r"of|for|in|at|around|on|about|tell|me|please|can|could|would|you|"
        r"will|be|like|show|give|there|it|going|happening|do|does|how|"
        r"was|were|and|to|expect|chance|possible|possibility|i|want|need|"
        r"know|looking|get|if|whether)\b",
        " ",
        location,
    )
    location = re.sub(r"[^\w\s,'-]", " ", location, flags=re.UNICODE)
    location = re.sub(r"\s+", " ", location).strip(" ,?.!")
    if not location:
        raise WeatherError(
            WEATHER_LOCATION_NOT_FOUND,
            status=422,
        )
    if len(location) > 100:
        raise WeatherError("Enter a city name (up to 100 characters).", status=400)

    return {
        "location": location,
        "period": period,
        "is_rainy_season": is_rainy_season,
        "question": normalized,
        "weather_interest": weather_interest,
    }

def fetch_rainy_season_context(latitude, longitude, month):
    archive_query = urllib.parse.urlencode(
        {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": "1991-01-01",
            "end_date": "2020-12-31",
            "daily": "precipitation_sum",
            "timezone": "auto",
        }
    )
    archive = request_json(
        f"{ARCHIVE_URL}?{archive_query}",
        timeout=45,
        service="Historical weather service",
        cache_key=make_cache_key("historical", archive_query),
        cache_ttl=HISTORICAL_CACHE_TTL,
    )
    daily = archive.get("daily") or {}
    dates = daily.get("time") or []
    precipitation = daily.get("precipitation_sum") or []
    month_totals = {}
    for date, amount in zip(dates, precipitation):
        if amount is None:
            continue
        date_month = int(date[5:7])
        year = int(date[:4])
        month_totals.setdefault(date_month, {}).setdefault(year, 0.0)
        month_totals[date_month][year] += amount

    monthly_averages = {
        target_month: sum(years.values()) / len(years)
        for target_month, years in month_totals.items()
        if years
    }
    this_month_average = monthly_averages.get(month)
    if this_month_average is None:
        raise WeatherError("Historical rainfall data is not available for this location.")

    sorted_averages = sorted(monthly_averages.values())
    upper_quartile = sorted_averages[int(len(sorted_averages) * 0.75)]
    wet_month_threshold = max(50.0, upper_quartile)
    wet_months = [
        target_month
        for target_month, average in monthly_averages.items()
        if average >= wet_month_threshold
    ]
    return {
        "reference_period": "1991–2020",
        "month": month,
        "typical_monthly_precipitation_mm": round(this_month_average),
        "wet_season_months": wet_months,
        "is_typically_wet_month": month in wet_months,
    }

def fetch_yesterday_weather(location, parsed, yesterday):
    archive_query = urllib.parse.urlencode(
        {
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "start_date": yesterday.isoformat(),
            "end_date": yesterday.isoformat(),
            "daily": (
                "weather_code,temperature_2m_mean,temperature_2m_max,"
                "temperature_2m_min,apparent_temperature_mean,"
                "relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum"
            ),
            "timezone": "auto",
        }
    )
    archive = request_json(
        f"{ARCHIVE_URL}?{archive_query}",
        timeout=45,
        service="Historical weather service",
        cache_key=make_cache_key("weather-yesterday", archive_query),
        cache_ttl=YESTERDAY_CACHE_TTL,
    )
    daily = archive.get("daily") or {}
    dates = daily.get("time") or []
    if not dates or not daily.get("weather_code"):
        raise WeatherError("Historical weather is not available for that date.")

    weather = {
        "location": location["display_name"],
        "location_note": location.get("note"),
        "question": parsed["question"],
        "period": parsed["period"],
        "period_date": dates[0],
        "local_time": "",
        "weather_code": daily["weather_code"][0],
        "condition": weather_description(daily["weather_code"][0]),
        "temperature_c": (daily.get("temperature_2m_mean") or [None])[0],
        "feels_like_c": (daily.get("apparent_temperature_mean") or [None])[0],
        "humidity_percent": (daily.get("relative_humidity_2m_mean") or [None])[0],
        "wind_kmh": (daily.get("wind_speed_10m_max") or [None])[0],
        "today_high_c": (daily.get("temperature_2m_max") or [None])[0],
        "today_low_c": (daily.get("temperature_2m_min") or [None])[0],
        "precipitation_mm": (daily.get("precipitation_sum") or [None])[0],
        "precipitation_probability_percent": None,
        "weather_interest": parsed["weather_interest"],
        "rainy_season": None,
    }
    if parsed["is_rainy_season"]:
        weather["rainy_season"] = fetch_rainy_season_context(
            location["latitude"],
            location["longitude"],
            yesterday.month,
        )
    return weather

def fetch_weather(query):
    parsed = parse_weather_question(query)
    city = parsed["location"]
    region_locations = {
        "kerala": {
            "name": "Kerala",
            "admin1": "Kerala",
            "country": "India",
            "latitude": 10.8505,
            "longitude": 76.2711,
            "note": "State-wide conditions are approximated from central Kerala.",
        },
        "kashmir": {
            "name": "Kashmir (Srinagar)",
            "admin1": "Jammu and Kashmir",
            "country": "India",
            "latitude": 34.08565,
            "longitude": 74.80555,
            "note": "Regional conditions are approximated using Srinagar.",
        },
    }
    region_key = city.casefold().strip().replace(",", "")
    region_key = re.sub(r"\s+", " ", region_key)
    if region_key.endswith(" india"):
        region_key = region_key[:-6].strip()
    location = region_locations.get(region_key)
    if location is None:
        geocoding_query = urllib.parse.urlencode(
            {"name": city, "count": 10, "language": "en", "format": "json"}
        )
        location_data = request_json(
            f"{GEOCODING_URL}?{geocoding_query}",
            cache_key=make_cache_key("geocoding", normalize_place_name(city)),
            cache_ttl=GEOCODING_CACHE_TTL,
        )
        locations = location_data.get("results", [])
        normalized_city = normalize_place_name(city)
        exact_matches = [
            item
            for item in locations
            if normalized_city
            in {
                normalize_place_name(item.get("name", "")),
                normalize_place_name(
                    " ".join(
                        part
                        for part in (
                            item.get("name", ""),
                            item.get("country", ""),
                        )
                        if part
                    )
                ),
                normalize_place_name(
                    " ".join(
                        part
                        for part in (
                            item.get("name", ""),
                            item.get("admin1", ""),
                            item.get("country", ""),
                        )
                        if part
                    )
                ),
            }
        ]
        if not exact_matches:
            raise WeatherError(WEATHER_LOCATION_NOT_FOUND, status=422)
        location = exact_matches[0]
    forecast_query = urllib.parse.urlencode(
        {
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "current": (
                "temperature_2m,relative_humidity_2m,apparent_temperature,"
                "precipitation,weather_code,wind_speed_10m"
            ),
            "timezone": "auto",
            "forecast_days": 3,
            "daily": (
                "weather_code,temperature_2m_max,temperature_2m_min,"
                "precipitation_sum,precipitation_probability_max"
            ),
        }
    )
    forecast_url = f"{FORECAST_URL}?{forecast_query}"
    forecast = request_json(
        forecast_url,
        cache_key=make_cache_key("forecast", forecast_query),
        cache_ttl=FORECAST_CACHE_TTL,
    )
    current = forecast.get("current")
    daily = forecast.get("daily")
    if not current or not daily:
        raise WeatherError("The weather service returned incomplete data.")
    if not current.get("time"):
        raise WeatherError("The weather service returned an invalid local time.")

    place_parts = [location["name"]]
    if location.get("admin1") and location["admin1"] != location["name"]:
        place_parts.append(location["admin1"])
    if location.get("country"):
        place_parts.append(location["country"])
    location["display_name"] = ", ".join(place_parts)

    local_now = datetime.datetime.fromisoformat(current["time"])
    if parsed["period"] in {"yesterday", "day_before_yesterday"}:
        days_ago = 2 if parsed["period"] == "day_before_yesterday" else 1
        return fetch_yesterday_weather(
            location,
            parsed,
            local_now.date() - datetime.timedelta(days=days_ago),
        )

    day_index = {
        "tomorrow": 1,
        "day_after_tomorrow": 2,
    }.get(parsed["period"], 0)
    daily_dates = daily.get("time") or []
    if day_index >= len(daily_dates):
        raise WeatherError("The forecast service returned incomplete daily data.")
    is_future = parsed["period"] in {"tomorrow", "day_after_tomorrow"}
    requested_code = (
        (daily.get("weather_code") or [None, None, None])[day_index]
        if is_future
        else current.get("weather_code")
    )
    weather = {
        "location": location["display_name"],
        "location_note": location.get("note"),
        "question": parsed["question"],
        "period": parsed["period"],
        "weather_interest": parsed["weather_interest"],
        "period_date": daily_dates[day_index],
        "local_time": current.get("time", ""),
        "weather_code": requested_code,
        "condition": weather_description(requested_code),
        "temperature_c": (
            (daily.get("temperature_2m_max") or [None, None, None])[day_index]
            if is_future
            else current.get("temperature_2m")
        ),
        "feels_like_c": (
            None if is_future else current.get("apparent_temperature")
        ),
        "humidity_percent": (
            None if is_future else current.get("relative_humidity_2m")
        ),
        "wind_kmh": None if is_future else current.get("wind_speed_10m"),
        "today_high_c": (daily.get("temperature_2m_max") or [None, None, None])[day_index],
        "today_low_c": (daily.get("temperature_2m_min") or [None, None, None])[day_index],
        "precipitation_mm": (
            (daily.get("precipitation_sum") or [None, None, None])[day_index]
            if is_future
            else current.get("precipitation")
        ),
        "precipitation_probability_percent": (
            daily.get("precipitation_probability_max") or [None, None, None]
        )[day_index],
        "rainy_season": None,
    }
    if parsed["is_rainy_season"]:
        month = int(daily_dates[day_index][5:7])
        weather["rainy_season"] = fetch_rainy_season_context(
            location["latitude"],
            location["longitude"],
            month,
        )
    return weather

WEATHER_TOPIC_PATTERN = re.compile(
    r"\b(?:weather|forecast|temperature|rain|rainy|rainfall|drizzle|shower|"
    r"monsoon|snow|snowy|snowfall|wind|windy|breezy|humidity|precipitation|"
    r"storm|thunder|sun|sunny|sunshine|clear|cloud|cloudy|clouds|overcast|"
    r"fog|foggy|mist|misty|hot|warm|heat|heatwave|cold|cool|chilly|freezing)\b",
    re.IGNORECASE,
)
QUESTION_START_PATTERN = re.compile(
    r"^(?:who|what|when|where|why|which|whose|whom|how|"
    r"can|could|would|will|should|is|are|do|does|did)\b",
    re.IGNORECASE,
)
WEATHER_LOCATION_NOT_FOUND = (
    "Sorry, I can't find the weather for the city or country you requested. "
    "Please try another city or country. Thank you."
)
