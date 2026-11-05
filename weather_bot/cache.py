import base64
import binascii
import hashlib
import json
import logging

import redis

from .config import REDIS_URL

logger = logging.getLogger(__name__)

redis_client = (
    redis.Redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=1,
    )
    if REDIS_URL
    else None
)

def make_cache_key(namespace, value):
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"weather-bot:{namespace}:v1:{digest}"

def get_cached_json(key):
    if redis_client is None:
        return None

    try:
        cached_value = redis_client.get(key)
    except redis.exceptions.RedisError as error:
        logger.warning("Redis cache read failed; continuing without cache: %s", error)
        return None

    if cached_value is None:
        return None

    try:
        return json.loads(cached_value)
    except json.JSONDecodeError as error:
        logger.warning("Ignoring invalid JSON in Redis cache key %s: %s", key, error)
        return None

def set_cached_json(key, value, ttl_seconds):
    if redis_client is None:
        return

    try:
        redis_client.set(key, json.dumps(value), ex=ttl_seconds)
    except redis.exceptions.RedisError as error:
        logger.warning("Redis cache write failed; continuing without cache: %s", error)

def get_cached_speech(key):
    cached_value = get_cached_json(key)
    if not isinstance(cached_value, dict):
        return None

    encoded_audio = cached_value.get("audio")
    media_type = cached_value.get("media_type")
    if not isinstance(encoded_audio, str) or not isinstance(media_type, str):
        return None

    try:
        return base64.b64decode(encoded_audio, validate=True), media_type
    except (ValueError, binascii.Error) as error:
        logger.warning("Ignoring invalid audio in Redis cache key %s: %s", key, error)
        return None

def set_cached_speech(key, audio, media_type, ttl_seconds):
    set_cached_json(
        key,
        {
            "audio": base64.b64encode(audio).decode("ascii"),
            "media_type": media_type,
        },
        ttl_seconds,
    )
