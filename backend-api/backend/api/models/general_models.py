"""General models"""

from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.models.model_helpers import Base, DateMixin, UUIDMixin


class Log(Base, UUIDMixin, DateMixin):
    """Logs errors in our requests"""

    __tablename__ = "log"

    request = Column(Text(), default=None)
    error = Column(Text(), default=None)
    status_code = Column(Integer(), default=None)
    method = Column(Text(), default=None)

    def __str__(self) -> str:
        return f"{self.request}-{self.error}"


class Feedback(Base, UUIDMixin, DateMixin):
    "Stores a feedback object"

    __tablename__ = "feedback"

    text: Mapped[str] = mapped_column(Text())
    emoji: Mapped[int]
    url: Mapped[str] = mapped_column(Text())
    email: Mapped[None | str] = mapped_column(Text())


class StripeEvent(Base, UUIDMixin, DateMixin):
    """Audit record of every Stripe webhook event received.

    The unique event_id doubles as the dedupe key: Stripe redelivers events,
    and the webhook treats a conflicting insert as "already processed". Only
    the Stripe webhook (routers/stripe_lite.py) writes here — the route is
    excluded from on-prem/Lite builds, so this table stays empty there.
    """

    __tablename__ = "stripe_event"

    event_id: Mapped[str] = mapped_column(String(255), unique=True)
    type: Mapped[str] = mapped_column(String(100))
    livemode: Mapped[bool]
