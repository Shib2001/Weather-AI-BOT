import json
import sys
import urllib.error
import urllib.request

from .cache import get_cached_json, set_cached_json
from .errors import WeatherError

def request_json(
    url,
    headers=None,
    data=None,
    timeout=20,
    service="weather service",
    cache_key=None,
    cache_ttl=None,
):
    if cache_key and cache_ttl:
        cached_value = get_cached_json(cache_key)
        if cached_value is not None:
            return cached_value

    request = urllib.request.Request(url, headers=headers or {}, data=data)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
            if cache_key and cache_ttl:
                set_cached_json(cache_key, result, cache_ttl)
            return result
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        print(f"{service} HTTP {error.code}: {detail}", file=sys.stderr)
        raise WeatherError(
            f"{service} request failed. Please try again shortly."
        ) from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise WeatherError(
            f"Could not connect to {service}. Check your internet connection."
        ) from error
    except json.JSONDecodeError as error:
        raise WeatherError(f"{service} returned an invalid response.") from error
