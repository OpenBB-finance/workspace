"""Allow us to configure rate limiting for the API."""

from fastapi import Request
from fastapi.security.utils import get_authorization_scheme_param
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from api import auth_helpers
from utilities.config import settings

settings.setup_logging()
storage_uri = None if settings.is_test() else settings.get_redis_url()


logger.info(f"Initializing rate limiter with storage_uri: {storage_uri}")


def get_remote_address_w_logging(request: Request) -> str:
    """Log rate limit information for debugging."""
    ip = get_remote_address(request)
    x_forwarded_for = request.headers.get("x-forwarded-for", None)
    logger.info(
        f"Rate limit check - IP: {ip}, User-Agent: {request.headers.get('User-Agent')}"
    )
    logger.info(f"Request headers: {dict(request.headers)}")
    return x_forwarded_for or ip


limiter = Limiter(key_func=get_remote_address_w_logging, storage_uri=storage_uri)
LIMIT_DEFAULT = "50/minute"
LIMIT_FEW = "10/minute"


def exempt_user_agent(request: Request) -> bool:
    """Exempt frontend from rate limiting. This is done by providing a custom
    user agent in the header.
    """
    user_agent = request.headers.get("X-OpenBB-User-Agent") or request.headers.get(
        "User-Agent"
    )
    if user_agent is None:
        return False
    frontend = settings.OPENBB_FRONTEND_USER_AGENT
    return frontend in user_agent


def exempt_openbb_ai(request: Request) -> bool:
    """Exempt OpenBB AI from rate limiting.

    Only exempts requests that:
    1. Have a valid OpenBB Authorization token
    2. Are running in development environment

    Returns
    -------
    bool
        True if the request should be exempt from rate limiting
    """
    if settings.SELFURL != "https://payments.openbb.dev":
        return False

    try:
        openbb_auth = request.headers.get("X-OpenBB-Authorization")
        openbb_scheme, openbb_param = get_authorization_scheme_param(openbb_auth)

        if openbb_scheme.lower() == "bearer":
            auth_helpers.check_openbb(openbb_param)
            return True
    except auth_helpers.credentials_exception:
        return False

    return False
