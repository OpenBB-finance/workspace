"""For helpers that dont import from modules in this repo"""

import enum
import html
import json
import random
import re
import string
from datetime import UTC, datetime, timedelta  # type: ignore
from typing import Any
from urllib.parse import quote
from uuid import UUID

import bcrypt
import jwt
from fastapi.encoders import jsonable_encoder

from utilities import config, rq_results


def verify_password(plain_password: str, hashed_password: str | bytes) -> bool:
    """Verifies that the given password matches the given hash

    Parameters
    ----------
    plain_password : str
        The password to be checked
    hashed_password : str | bytes
        The hash to be checked against. PasswordType returns str on MySQL and
        bytes on SQLite/Postgres, so accept either.
    """
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode("utf-8")
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password)


def get_password_hash(password: str) -> bytes:
    """Hashes the given password

    Parameters
    ----------
    password : str
        The unhashed password
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())


def round_seconds(obj: datetime) -> datetime:
    half_second = 500_000
    if obj.microsecond >= half_second:
        obj += timedelta(seconds=1)
    return obj.replace(microsecond=0)


def get_datetime(unix: int) -> datetime:
    """Converts a Unix timestamp to a datetime

    Parameters
    ----------
    unix : int
        The Unix timestamp to convert


    Returns
    ---------
    datetime : datetime
        The converted datetime
    """
    dt = datetime.fromtimestamp(unix, UTC)
    return dt.replace(tzinfo=UTC)


def get_exp(text: str) -> datetime:
    """Gets the expiration date from a JWT token"""
    data = jwt.decode(text, options={"verify_signature": False})
    unix_dt = int(data["exp"])
    return get_datetime(unix_dt)


def get_midnight() -> datetime:
    return datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


def get_now() -> datetime:
    return datetime.now(UTC)


def time_ms_now(ts: int | None, default: datetime | None = get_now()) -> datetime:
    """Returns the current timestamp if ts is None, otherwise returns the given timestamp"""
    if isinstance(ts, datetime):
        return ts
    if not ts:
        return default
    return datetime.fromtimestamp(ts / 1000, UTC)


def get_result_ttl(delta: timedelta | float) -> int:
    if isinstance(delta, int | float):
        delta = timedelta(seconds=delta)

    current = datetime.now(UTC).replace(second=0, microsecond=0)
    diff = current + delta
    return int(max(0, (diff - current).total_seconds()))


def get_month() -> datetime:
    return datetime.now(UTC) + timedelta(days=30)


def get_day(n: int = 1) -> datetime:
    return datetime.now(UTC) + timedelta(days=n)


def random_string(n: int = 8) -> str:
    options = string.digits + string.ascii_lowercase + string.ascii_uppercase
    return "".join(random.choices(options, k=n))


def random_code() -> str:
    return random_string(12)


def random_password() -> str:
    base = random_string(12)
    uppercase = random.choice(string.ascii_uppercase)
    lowercase = random.choice(string.ascii_lowercase)
    number = random.choice(string.digits)
    punctuation = r"""!#$%&*+-/<=>?@\^"""
    special = random.choice(punctuation)

    return f"{uppercase}{base}{lowercase}{number}{special}"


def random_long_string() -> str:
    return random_string(40)


def clean_dict(old_dict: dict[Any, Any]) -> dict[Any, Any]:
    new_dict = {}
    for key, value in old_dict.items():
        if value is not None:
            new_dict[key] = value
    return new_dict


def get_filter(
    name: str, platform_id: str, is_group: bool, active: bool = True
) -> dict[str, Any]:
    filt = {
        "name": name,
        "platform_id": platform_id,
        "is_group": is_group,
        "active": active,
    }
    return filt


def clean_text(text: None | str) -> None | str:
    if text == "None":
        return None
    if text == "[]":
        return None
    if text:
        return text[:1000]
    return text


def remove_redis(name: str, platform_id: str) -> None:
    r = rq_results.redis_conn_bots
    r.delete(f"{name}_{platform_id}")


def version_filter(version: str):
    try:
        return [int(u) for u in version.split(".")]
    except ValueError:
        return [0, 0, 0]


def get_systems() -> list[str]:
    os_list = ["darwin", "windows"]  # "linux",
    arch_list = ["x86_64", "aarch64"]  # , "i686", "armv7"
    systems = [f"{x}-{y}" for x in os_list for y in arch_list]
    return systems


def flatten_dict(base: str, original: dict, new: dict, separator: str = "/") -> None:
    for key, value in original.items():
        if isinstance(value, dict):
            active_sep = separator if base else ""
            flatten_dict(base + active_sep + key, value, new)
        else:
            new[base + separator + key] = value


def check_email(email: str) -> bool:
    """Checks whether the given username meets requirements

    Parameters
    ----------
    email : str
        The email to be checked

    Returns
    ----------
    valid : bool
        Whether the email is valid
    """
    # The below is a RFC 5322 compliant regex: https://uibakery.io/regex-library/email-regex-python
    pattern = "(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])"  # noqa: E501
    return bool(re.match(pattern, email.lower()))


def set_tpro_redis(key: UUID, value):
    r = config.settings.get_redis_session("pro")
    r.set(str(key), json.dumps(jsonable_encoder(value)))


def remove_session_redis(key: UUID):
    r = config.settings.get_redis_session("sdk")
    r.delete(f"pro:sessions:{key}")


class PermissionEnum(enum.Enum):
    view = "view"
    comment = "comment"
    edit = "edit"


class AppStatus(enum.Enum):
    submitted = "submitted"
    verified = "verified"
    development = "development"
    published = "published"
    disabled = "disabled"
    removed = "removed"


class AuthType(enum.Enum):
    api_key = "api_key"
    none = "none"
    custom = "custom"


class SubscriptionStatus(enum.Enum):
    active = "active"
    disconnected = "disconnected"


class ChatMessageRole(enum.Enum):
    ai = "ai"
    human = "human"
    summary = "summary"
    system = "system"
    tool = "tool"


def clean_email(email: str) -> str:
    if email.count("@") != 1:
        raise ValueError("The email should only have one '@'")
    first, second = email.split("@")
    first_no_periods = first.replace(".", "")
    first_clean = first_no_periods.split("+")[0]
    return first_clean + "@" + second


def create_url(path: str, base: str = config.settings.PROURL, **kwargs: str):
    url = f"{base}/{path}"
    if kwargs:
        url += "?" + "&".join([f"{k}={quote(v)}" for k, v in kwargs.items()])
    return url


def create_html(message: None | str):
    if not message:
        return "<br>"
    escaped = message.replace("\n", "<br>")
    clean = html.escape(re.sub(r"<[^>]*>", "", escaped))
    the_css = "margin: 20px 0; padding-left: 15px; border-left: 5px solid #ccc; font-style: italic; color: #555;"
    before = '<br><p style="color: #000000">Here is a brief message from them:</p>'
    return f'{before}<blockquote style="{the_css}">{clean}</blockquote>'
