import asyncio
from asyncio import ensure_future
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime, timedelta
from functools import wraps
from traceback import format_exception
from typing import Any

from loguru import logger
from starlette.concurrency import run_in_threadpool

from utilities.config import settings

NoArgsNoReturnFuncT = Callable[[], None]
NoArgsNoReturnAsyncFuncT = Callable[[], Coroutine[Any, Any, None]]
NoArgsNoReturnDecorator = Callable[
    [NoArgsNoReturnFuncT | NoArgsNoReturnAsyncFuncT], NoArgsNoReturnAsyncFuncT
]


def next_schedule_dt(schedule: datetime, add_days: int = 1) -> datetime:
    """This function calculates the next schedule time for a repeated function.

    Parameters
    ----------
    schedule: `datetime`
        The schedule time should be in UTC.
    """

    if schedule.tzinfo is None:
        schedule = schedule.replace(tzinfo=UTC)

    if schedule < datetime.now(UTC):
        schedule += timedelta(days=add_days)

    return schedule


def next_execution_time(
    seconds: float | timedelta | None, schedule: datetime | None = None
) -> float:
    """This function calculates the next time a repeated function should be executed.

    Parameters
    ----------
    seconds: `float` | `timedelta` | `None` (default `None`)
        The number of seconds to wait between repeated calls
    schedule: `datetime` | `None` (default `None`)
        If not None, the function will wait until the schedule time to make the first call.
        If the schedule time has already passed, the first call will be made the next day.
        The schedule time should be in UTC.
    """
    if seconds is None and schedule is None:
        raise ValueError("At least one of seconds or schedule must be provided")

    if schedule is None:
        return seconds.total_seconds() if isinstance(seconds, timedelta) else seconds

    now = datetime.now(UTC)

    new_schedule = next_schedule_dt(schedule)
    return (new_schedule - now).total_seconds()


def repeat_every(
    *,
    seconds: float | timedelta = None,
    schedule: datetime | None = None,
    wait_first: bool = False,
    raise_exceptions: bool = False,
    max_repetitions: int | None = None,
) -> NoArgsNoReturnDecorator:
    """This function returns a decorator that modifies a function so it is periodically re-executed after its first call.
    The function it decorates should accept no arguments and return nothing. If necessary, this can be accomplished
    by using `functools.partial` or otherwise wrapping the target function prior to decoration.

    Parameters
    ----------
    seconds: `float` | `timedelta` | `None` (default `None`)
        The number of seconds to wait between repeated calls
    schedule: `datetime` | `None` (default `None`)
        If not None, the function will wait until the schedule time to make the first call.
        If the schedule time has already passed, the first call will be made the next day.
        The schedule time should be in UTC.
    wait_first: `bool` (default `False`)
        If True, the function will wait for a single period before the first call
    raise_exceptions: `bool` (default `False`)
        If True, errors raised by the decorated function will be raised to the event loop's exception handler.
        Note that if an error is raised, the repeated execution will stop.
        Otherwise, exceptions are just logged and the execution continues to repeat.
        See https://docs.python.org/3/library/asyncio-eventloop.html#asyncio.loop.set_exception_handler for more info.
    max_repetitions: `int` | `None` (default `None`)
        The maximum number of times to call the repeated function. If `None`, the function is repeated forever.

    Exceptions
    ----------
    `ValueError`
        If neither `seconds` nor `schedule` is provided.
    """

    if seconds is None and schedule is None:
        raise ValueError("At least one of seconds or schedule must be provided")

    first_sleep = next_execution_time(seconds, schedule)

    def decorator(
        func: NoArgsNoReturnAsyncFuncT | NoArgsNoReturnFuncT,
    ) -> NoArgsNoReturnAsyncFuncT:
        """
        Converts the decorated function into a repeated, periodically-called version of itself.
        """
        is_coroutine = asyncio.iscoroutinefunction(func)

        @wraps(func)
        async def wrapped() -> None:
            repetitions = 0

            async def loop() -> None:
                nonlocal repetitions
                if wait_first:
                    await asyncio.sleep(first_sleep)
                while max_repetitions is None or repetitions < max_repetitions:
                    try:
                        if is_coroutine:
                            await func()  # type: ignore
                        else:
                            await run_in_threadpool(func)
                        repetitions += 1
                    except Exception as exc:
                        formatted_exception = "".join(
                            format_exception(type(exc), exc, exc.__traceback__)
                        )
                        logger.error(
                            f"Exception in repeated task {func.__name__}: {formatted_exception}"
                        )
                        if raise_exceptions:
                            raise exc

                    await asyncio.sleep(next_execution_time(seconds, schedule))

            ensure_future(loop())

        return wrapped

    return decorator


def require_hubspot_enabled(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not settings.HUBSPOT:
            logger.debug("Hubspot is disabled, skipping contact sync.")
            return None
        return func(*args, **kwargs)

    return wrapper
