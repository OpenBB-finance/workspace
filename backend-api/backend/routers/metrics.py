"""Metrics routes"""

import gzip
import pickle  # noqa: S403
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api import base
from api.database import aget_read_db
from api.models import User
from api.rate_limit import LIMIT_DEFAULT, exempt_user_agent, limiter
from utilities.config import settings

router = APIRouter(prefix="/metrics")


class UserCount(BaseModel):
    timestamp: datetime
    count: int


class UserCountReturn(BaseModel):
    users: list[UserCount]


async def get_usercount_json(db: AsyncSession) -> list[UserCount]:
    r = settings.get_redis_session("pro")
    existing = r.get("METRICS_USERCOUNT")
    if existing:
        decompressed = gzip.decompress(existing)
        return pickle.loads(decompressed)  # noqa: S301
    query = select(User.created_date).order_by(User.created_date)
    result = [x[0] for x in (await db.execute(query)).all()]

    current_date = result[0]
    total_count = 0
    final_results: list[UserCount] = []
    now_time = base.get_now()
    while current_date < now_time:
        if result and result[0] <= current_date:
            total_count += 1
            result.pop(0)
        else:
            final_results.append(UserCount(timestamp=current_date, count=total_count))
            current_date += timedelta(weeks=1)

    if result:
        final_results.append(
            UserCount(timestamp=now_time, count=total_count + len(result))
        )

    data_before = pickle.dumps(final_results)
    data_after = gzip.compress(data_before)
    r.set("METRICS_USERCOUNT", data_after, ex=60 * 60 * 24)
    return final_results


@router.get("/users", response_model=UserCountReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_usercount(request: Request, db: AsyncSession = Depends(aget_read_db)):
    new_json = await get_usercount_json(db)
    return {"users": new_json}
