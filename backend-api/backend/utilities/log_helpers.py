import json
import logging
import re
import sys
import traceback
from os import environ
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from .config import Settings


LOGURU_FORMAT = (
    "<light-yellow>{time:YYYY-MM-DD HH:mm:ss.SSS}</light-yellow>|"
    "<light-magenta><level>{level}</level></light-magenta>|"
    "<light-red>{name}</light-red>|<green>{function}</green>|<cyan>{line}</cyan> "
    "- <light-magenta><level>{message}</level></light-magenta>"
)


FILTER_REGEX = re.compile(
    r"(.*?{?['\",]?(?:api|key|token|auth)['\"]?:\s*)['\"]?[\s]*?(.*?)(.*?)['\",}.]",
    re.IGNORECASE | re.MULTILINE,
)

URL_QUERY_FILTER = re.compile(
    r"((?:\?|&)(api|key|token|auth|_)*?)=(?:.*?)(?:'|\"|&|$)",
    re.IGNORECASE | re.MULTILINE,
)


def get_secrets() -> dict[str, str]:
    from .config import settings  # noqa: F401, PLC0415

    base_dict = settings.model_dump()
    for key in [
        "UNUSABLE_JSON_CHARACTERS",
        "MAX_DICT_LEN",
        "FRONTENDURL",
        "MODE",
        "DB_PORT",
        "REDIS_PORT",
        "HUB_RELEASE_DATE",
        "WORKERS",
        "LOGURU_COLORIZE",
        "JSON_LOGS",
        "LOG_LEVEL",
        "REDIS_DB_BOT",
        "REDIS_DB_PRO",
        "REDIS_DB_SDK",
        "REDIS_SSL_CERT_REQ",
    ]:
        if key in base_dict:
            del base_dict[key]
    secrets = {}
    for key, value in base_dict.items():
        new_value = str(value)
        if new_value and len(new_value) > 5:  # noqa: PLR2004
            secrets[str(key)] = new_value
    return secrets


def obfuscate_secrets(message: str) -> str:

    for key, value in get_secrets().items():
        message = message.replace(value, key)

    cleaned_message = FILTER_REGEX.sub(r"\1'********'", message)
    return URL_QUERY_FILTER.sub(r"\1=********'", cleaned_message)


class InterceptHandler(logging.Handler):
    def emit(self, record):  # noqa: PLR6301
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


class stdoutSink:
    def write(self, message):  # noqa: PLR6301
        sys.__stdout__.write(obfuscate_secrets(message))

    def flush(self):  # noqa: PLR6301
        sys.__stdout__.flush()

    def isatty(self):  # noqa: PLR6301
        return sys.__stdout__.isatty()


if not environ.get("PYTEST_IS_RUNNING"):
    sys.stdout = stdoutSink()  # type: ignore


def serialize(record: dict) -> str:
    if any(
        record["function"] == skip_func
        for skip_func in ["<module>", "callHandlers", "pre_fork"]
    ):
        return None

    subset = {
        "asctime": record["time"].strftime("%Y-%m-%d %H:%M:%S.%f"),
        "levelname": record["level"].name,
        "name": record["name"],
        "message": record["message"],
        "function": record["function"],
        "line": record["line"],
    }

    if exception := record.get("exception"):
        subset["exc_info"] = {
            "type": None if exception.type is None else exception.type.__name__,
            "value": str(exception.value),
            "traceback": traceback.format_tb(exception.traceback),
        }

    if extras := record.get("extra"):
        subset.update(extras)

    if extras and "exclude" in extras:
        return None

    return json.dumps(subset)


def jsonsink(message):
    if serialized := serialize(message.record):
        print(obfuscate_secrets(serialized))  # noqa


def setup_logging(settings: "Settings") -> None:

    sys.tracebacklimit = 3

    HANDLERS = [
        {
            "sink": sys.stdout,
            "serialize": settings.JSON_LOGS,
            "colorize": settings.LOGURU_COLORIZE,
            "format": LOGURU_FORMAT,
            "level": settings.LOG_LEVEL,
            "diagnose": True,
            "backtrace": False,
        }
    ]

    intercept_handler = InterceptHandler()
    logging.root.setLevel(settings.LOG_LEVEL)

    seen = set()
    for name in [
        *logging.root.manager.loggerDict.keys(),
        "gunicorn.access",
        "gunicorn.error",
        "uvicorn.access",
        "uvicorn.error",
    ]:
        if name not in seen:
            seen.add(name.split(".")[0])
            logging.getLogger(name).handlers = [intercept_handler]

    logger.configure(handlers=HANDLERS)
    logger.add(jsonsink)
