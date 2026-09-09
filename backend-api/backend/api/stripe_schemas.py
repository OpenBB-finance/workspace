from datetime import datetime
from typing import Annotated, Generic, Literal, TypeVar

from annotated_types import Len
from pydantic import BeforeValidator, ConfigDict, EmailStr

from utilities.config import BaseModel

DataType = TypeVar("DataType")


def date_or_none(v: str) -> None | str:
    if v == "None":
        return None
    return v


class DataObject(BaseModel):
    object: dict
    previous_attributes: None | dict = None


class PeriodObject(BaseModel):
    end: datetime
    start: datetime


class LineItem(BaseModel):
    object: Literal["line_item"]
    id: str
    period: PeriodObject


class ListObject(BaseModel, Generic[DataType]):
    object: Literal["list"]
    data: DataType
    has_more: bool
    total_count: int
    url: str


class Invoice(BaseModel):
    object: Literal["invoice"]
    id: str
    due_date: Annotated[None | datetime, BeforeValidator(date_or_none)]
    paid: bool
    period_end: datetime
    customer: str
    customer_name: None | str
    customer_email: None | EmailStr
    collection_method: Literal["charge_automatically", "send_invoice"]
    # Why Stripe issued this invoice: "subscription_create" on first payment,
    # "subscription_cycle" on renewals. Kept loose (str) — Stripe adds values.
    billing_reason: None | str = None
    # For now there HAS to be exactly one line_item
    lines: ListObject[Annotated[list[LineItem], Len(min_length=1, max_length=1)]]


class CheckoutSession(BaseModel):
    # Stripe sends many fields we don't need; pydantic ignores the extras by default.
    object: Literal["checkout.session"]
    id: str
    customer: None | str
    customer_email: None | EmailStr
    # Top-level may be null; the actual email always lands in customer_details.
    customer_details: None | dict
    mode: Literal["payment", "subscription", "setup"]
    payment_status: Literal["paid", "unpaid", "no_payment_required"]
    status: None | Literal["open", "complete", "expired"]
    subscription: None | str
    metadata: dict[str, str] = {}
    custom_fields: list[dict] = []

    def resolved_email(self) -> str | None:
        if self.customer_email:
            return self.customer_email
        if self.customer_details and isinstance(self.customer_details, dict):
            return self.customer_details.get("email")
        return None

    def customer_name(self) -> str | None:
        if self.customer_details and isinstance(self.customer_details, dict):
            return self.customer_details.get("name")
        return None

    def individual_name(self) -> str | None:
        """The buyer's own name from Stripe's native name collection.

        When business name collection is enabled, customer_details.name holds
        the business name — individual_name is the only field with the person.
        """
        if self.customer_details and isinstance(self.customer_details, dict):
            return self.customer_details.get("individual_name")
        return None

    def business_name(self) -> str | None:
        if self.customer_details and isinstance(self.customer_details, dict):
            return self.customer_details.get("business_name")
        return None

    def custom_field(self, key: str) -> str | None:
        """Pull a value from Checkout's custom_fields list by its `key`.

        Stripe nests the value under a per-type sub-dict, e.g.
        `{"key": "business_name", "type": "text", "text": {"value": "Acme"}}`.
        """
        for field in self.custom_fields:
            if not isinstance(field, dict) or field.get("key") != key:
                continue
            inner = field.get(field.get("type", ""))
            if isinstance(inner, dict):
                return inner.get("value")
        return None


class GeneralRequest(BaseModel):
    # type(lambda: None) is FunctionType in pure Python and the cyfunction
    # type when Cython-compiled — keeps methods from being seen as fields.
    model_config = ConfigDict(ignored_types=(type(lambda: None),))

    object: Literal["event"]
    id: str
    api_version: str
    created: datetime
    data: DataObject
    livemode: bool
    pending_webhooks: int
    request: dict
    type: str

    def to_invoice(self) -> Invoice:
        return Invoice(**self.data.object)

    def to_checkout_session(self) -> CheckoutSession:
        return CheckoutSession(**self.data.object)
