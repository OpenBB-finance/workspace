"""Tests for the Lite Checkout Stripe webhook (routers/stripe_lite.py).

Covers the high-risk paths:
  1. Bad signature is rejected (HMAC verification works).
  2. Stale timestamp is rejected (replay protection works).
  3. A valid checkout.session.completed event creates a User row keyed by
     stripe_id and dispatches yearly provisioning.
  4. The admin_email custom field, when present, receives the install email.

The lambda dispatch is stubbed in every test — no AWS call runs.
"""

import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from api.models import User
from routers import stripe_lite
from sqlalchemy import text
from utilities import config

_TEST_SECRET = "whsec_test_only_not_a_real_stripe_secret"  # noqa: S105


def _sign(body: bytes, secret: str = _TEST_SECRET, ts: int | None = None) -> str:
    """Build a Stripe-Signature header value matching `_verify_stripe_signature`."""
    ts = ts if ts is not None else int(time.time())
    payload_to_sign = f"{ts}.{body.decode('utf-8')}".encode()
    sig = hmac.new(secret.encode(), payload_to_sign, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


def _event(
    *,
    event_type: str = "checkout.session.completed",
    email: str = "buyer@example.com",
    customer: str = "cus_test_1",
    payment_status: str = "paid",
    admin_email: str | None = None,
    admin_email_key: str = "adminemail",
    individual_name: str | None = None,
    business_name: str | None = None,
    billing_name: str = "Buyer One",
    event_id: str | None = None,
) -> bytes:
    """Build the raw bytes of a synthetic Stripe event.

    Event ids default to a fresh unique value per call — Stripe never reuses
    ids, and the webhook dedupes on them, so a hardcoded id would make later
    tests silent no-ops against the persistent test DB.

    The shape mirrors a real payment-link event: the dashboard-created Admin
    Email custom field arrives with key `adminemail` (no underscore), and the
    buyer/company names come from Stripe's native name_collection feature as
    customer_details.individual_name / business_name — with customer_details.name
    set to the business name when business collection is on.
    """
    custom_fields = []
    if admin_email:
        custom_fields.append(
            {"key": admin_email_key, "type": "text", "text": {"value": admin_email}}
        )
    customer_details = {
        "email": email,
        "name": billing_name,
        "individual_name": individual_name,
        "business_name": business_name,
    }
    payload = {
        "object": "event",
        "id": event_id or f"evt_test_{uuid4().hex}",
        "api_version": "2024-01-01",
        "created": int(time.time()),
        "livemode": False,
        "pending_webhooks": 1,
        "request": {},
        "type": event_type,
        "data": {
            "object": {
                "object": "checkout.session",
                "id": "cs_test_1",
                "customer": customer,
                "customer_email": email,
                "customer_details": customer_details,
                "mode": "subscription",
                "payment_status": payment_status,
                "status": "complete",
                "subscription": "sub_test_1",
                "metadata": {},
                "custom_fields": custom_fields,
            }
        },
    }
    return json.dumps(payload).encode("utf-8")


@pytest.mark.asyncio
async def test_rejects_bad_signature(client, monkeypatch):
    """A forged signature must return 400 and not write to the DB."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)

    body = _event()
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": f"t={int(time.time())},v1=deadbeef",
            "content-type": "application/json",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_rejects_stale_timestamp(client, monkeypatch):
    """A correctly-signed but old request must be rejected as a replay."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_TOLERANCE_SECONDS", 300)

    body = _event()
    old_ts = int(time.time()) - 3600  # one hour ago, well past tolerance
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body, ts=old_ts),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 400


def _stub_provision(monkeypatch) -> dict:
    """Replace the lambda dispatch with a capture stub; returns the capture dict."""
    captured: dict = {}

    async def _fake_provision(*, function_name, payload, to_emails):
        captured["function_name"] = function_name
        captured["payload"] = payload
        captured["to_emails"] = to_emails

    monkeypatch.setattr(stripe_lite, "_provision_lite_install", _fake_provision)
    return captured


@pytest.mark.asyncio
async def test_checkout_completed_creates_user_and_provisions_yearly(
    client, db_session, monkeypatch
):
    """A valid checkout.session.completed event must persist (email, stripe_id)
    and dispatch provisioning with a yearly (365-day) expiration."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    captured = _stub_provision(monkeypatch)

    email = "stripe-lite-test@example.com"
    customer = "cus_stripe_lite_test_1"
    body = _event(email=email, customer=customer)

    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert response.json() == {"success": True}

    row = (
        await db_session.execute(
            text("SELECT stripe_id FROM user WHERE email = :email"),
            {"email": email},
        )
    ).first()
    assert row is not None, f"User row for {email} was not created"
    assert row.stripe_id == customer

    assert captured["payload"]["subscription_tier"] == "yearly"
    assert (
        captured["payload"]["expiration"]
        == (datetime.now() + timedelta(days=365)).date().isoformat()
    )
    assert captured["payload"]["email"] == email
    assert captured["to_emails"] == [email]  # no admin_email field -> purchaser only

    # Cleanup so re-runs don't trip the unique-email constraint.
    await db_session.execute(
        text("DELETE FROM user WHERE email = :email"), {"email": email}
    )
    await db_session.commit()


def _invoice_event(
    *,
    billing_reason: str = "subscription_cycle",
    email: str | None = "renewer@example.com",
    customer: str = "cus_test_renew_1",
    paid: bool = True,
) -> bytes:
    """Build the raw bytes of a synthetic Stripe invoice.paid event."""
    now = int(time.time())
    payload = {
        "object": "event",
        "id": f"evt_test_renewal_{uuid4().hex}",
        "api_version": "2024-01-01",
        "created": now,
        "livemode": False,
        "pending_webhooks": 1,
        "request": {},
        "type": "invoice.paid",
        "data": {
            "object": {
                "object": "invoice",
                "id": "in_test_1",
                "due_date": None,
                "paid": paid,
                "period_end": now,
                "customer": customer,
                "customer_name": "Renewer One",
                "customer_email": email,
                "collection_method": "charge_automatically",
                "billing_reason": billing_reason,
                "lines": {
                    "object": "list",
                    "data": [
                        {
                            "object": "line_item",
                            "id": "il_test_1",
                            "period": {"start": now, "end": now + 365 * 86400},
                        }
                    ],
                    "has_more": False,
                    "total_count": 1,
                    "url": "/v1/invoices/in_test_1/lines",
                },
            }
        },
    }
    return json.dumps(payload).encode("utf-8")


def _stub_renew(monkeypatch) -> dict:
    """Replace the renewal lambda dispatch with a capture stub."""
    captured: dict = {}

    async def _fake_renew(*, function_name, payload):
        captured["function_name"] = function_name
        captured["payload"] = payload

    monkeypatch.setattr(stripe_lite, "_renew_lite_install", _fake_renew)
    return captured


@pytest.mark.asyncio
async def test_renewal_invoice_dispatches_lambda_renewal(client, monkeypatch):
    """invoice.paid with billing_reason=subscription_cycle must invoke the
    lambda with is_renewal=True and a fresh yearly expiration — no email."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    monkeypatch.setattr(config.settings, "LITE_LAMBDA_FUNCTION_NAME", "lite-test-fn")
    captured = _stub_renew(monkeypatch)

    body = _invoice_event(email="renewer@example.com")
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert response.json() == {"success": True}

    assert captured["function_name"] == "lite-test-fn"
    assert captured["payload"]["is_renewal"] is True
    assert captured["payload"]["email"] == "renewer@example.com"
    assert captured["payload"]["full_name"] == "Renewer One"
    assert captured["payload"]["subscription_tier"] == "yearly"
    assert (
        captured["payload"]["expiration"]
        == (datetime.now() + timedelta(days=365)).date().isoformat()
    )


@pytest.mark.asyncio
async def test_initial_subscription_invoice_is_noop(client, monkeypatch):
    """invoice.paid with billing_reason=subscription_create is the FIRST
    payment — checkout.session.completed already provisions it, so the
    renewal path must not fire (no double provisioning)."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    monkeypatch.setattr(config.settings, "LITE_LAMBDA_FUNCTION_NAME", "lite-test-fn")
    captured = _stub_renew(monkeypatch)

    body = _invoice_event(billing_reason="subscription_create")
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert captured == {}, "renewal lambda must not be invoked for the first invoice"


@pytest.mark.asyncio
async def test_renewal_invoice_without_email_is_skipped(client, monkeypatch):
    """A renewal invoice with no customer email can't be matched to a user —
    skip the lambda instead of sending a payload the lambda can't act on."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    monkeypatch.setattr(config.settings, "LITE_LAMBDA_FUNCTION_NAME", "lite-test-fn")
    captured = _stub_renew(monkeypatch)

    body = _invoice_event(email=None)
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert captured == {}


@pytest.mark.asyncio
async def test_admin_email_and_purchaser_both_receive_install_email(
    client, db_session, monkeypatch
):
    """When Checkout collects an admin email custom field that differs from the
    purchaser email, both addresses get the install email; the User row stays
    keyed to the purchaser email."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    captured = _stub_provision(monkeypatch)

    email = "buyer-admin-test@example.com"
    admin_email = "it-admin@example.com"
    body = _event(email=email, customer="cus_admin_email_1", admin_email=admin_email)
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert captured["to_emails"] == [email, admin_email]
    assert captured["payload"]["email"] == email

    await db_session.execute(
        text("DELETE FROM user WHERE email = :email"), {"email": email}
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_same_admin_email_sends_once(client, db_session, monkeypatch):
    """An admin email matching the purchaser email (any casing) must not
    produce a duplicate send."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    captured = _stub_provision(monkeypatch)

    email = "same-admin-test@example.com"
    body = _event(
        email=email,
        customer="cus_same_admin_1",
        admin_email="Same-Admin-Test@Example.com",
    )
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert captured["to_emails"] == [email]

    await _cleanup(db_session, email=email)


@pytest.mark.asyncio
async def test_admin_email_underscore_key_variant(client, db_session, monkeypatch):
    """Accept the `admin_email` key spelling too, in case the payment link is
    ever recreated with an explicit key via the API."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    captured = _stub_provision(monkeypatch)

    email = "buyer-admin-underscore@example.com"
    admin_email = "it-admin-underscore@example.com"
    body = _event(
        email=email,
        customer="cus_admin_underscore_1",
        admin_email=admin_email,
        admin_email_key="admin_email",
    )
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert captured["to_emails"] == [email, admin_email]

    await _cleanup(db_session, email=email)


@pytest.mark.asyncio
async def test_individual_name_preferred_over_billing_name(
    client, db_session, monkeypatch
):
    """The greeting name must come from customer_details.individual_name
    (Stripe's native name collection) — customer_details.name holds the
    business name when business collection is on (real case: "Hi OpenBB,"
    instead of the buyer's name)."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    captured = _stub_provision(monkeypatch)

    email = "individual-name-test@example.com"
    body = _event(
        email=email,
        customer="cus_individual_name_1",
        individual_name="Didier Lopes",
        business_name="OpenBB",
        billing_name="OpenBB",
    )
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert captured["payload"]["full_name"] == "Didier Lopes"
    assert captured["payload"]["business_name"] == "OpenBB"

    await _cleanup(db_session, email=email)


@pytest.mark.asyncio
async def test_billing_name_fallback_without_individual_name(
    client, db_session, monkeypatch
):
    """Without native name collection on the session, fall back to
    customer_details.name so the greeting still gets something."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    captured = _stub_provision(monkeypatch)

    email = "billing-name-fallback-test@example.com"
    body = _event(email=email, customer="cus_billing_fallback_1")
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    assert captured["payload"]["full_name"] == "Buyer One"

    await _cleanup(db_session, email=email)


class _FakeLambdaPayload:
    def __init__(self, data: bytes):
        self._data = data

    async def read(self) -> bytes:
        return self._data


class _FakeLambdaClient:
    def __init__(self, response: dict):
        self._response = response

    async def invoke(self, FunctionName: str, Payload: bytes) -> dict:  # noqa: N803
        return self._response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def _stub_lambda_response(monkeypatch, handler_return: dict) -> None:
    """Make the aioboto3 lambda client return `handler_return` as the raw
    invoke payload — exactly what the handler returned, no unwrapping."""
    response = {"Payload": _FakeLambdaPayload(json.dumps(handler_return).encode())}

    class _FakeSession:
        def client(self, *args, **kwargs):
            return _FakeLambdaClient(response)

    monkeypatch.setattr(stripe_lite.aioboto3, "Session", _FakeSession)


@pytest.mark.asyncio
async def test_invoke_unwraps_http_envelope(monkeypatch):
    """Raw invoke returns the handler's API-Gateway-style envelope verbatim;
    callers need the JSON inside `body`, not the envelope itself."""
    inner = {"username": "u1", "access_key_id": "AKIA1", "secret_access_key": "s1"}
    _stub_lambda_response(
        monkeypatch,
        {"statusCode": 200, "headers": {}, "body": json.dumps(inner)},
    )
    result = await stripe_lite._invoke_lite_lambda("fn", {})
    assert result == inner


@pytest.mark.asyncio
async def test_invoke_raises_on_non_200_envelope(monkeypatch):
    """A non-200 envelope (409 duplicate, 404 not found) must raise with the
    real status instead of surfacing later as 'missing credentials'."""
    _stub_lambda_response(
        monkeypatch,
        {
            "statusCode": 409,
            "headers": {},
            "body": json.dumps({"detail": "already provisioned"}),
        },
    )
    with pytest.raises(RuntimeError, match="409"):
        await stripe_lite._invoke_lite_lambda("fn", {})


@pytest.mark.asyncio
async def test_invoke_passes_through_plain_payload(monkeypatch):
    """A response without a statusCode envelope is returned as-is."""
    plain = {"username": "u2", "expires": "2027-07-14"}
    _stub_lambda_response(monkeypatch, plain)
    result = await stripe_lite._invoke_lite_lambda("fn", {})
    assert result == plain


async def _cleanup(
    db_session, *, email: str | None = None, event_id: str | None = None
):
    """Remove rows a test created so re-runs don't trip unique constraints."""
    if email:
        await db_session.execute(
            text("DELETE FROM user WHERE email = :email"), {"email": email}
        )
    if event_id:
        await db_session.execute(
            text("DELETE FROM stripe_event WHERE event_id = :event_id"),
            {"event_id": event_id},
        )
    await db_session.commit()


@pytest.mark.asyncio
async def test_async_payment_succeeded_provisions(client, db_session, monkeypatch):
    """checkout.session.async_payment_succeeded (delayed payment methods like
    bank debits) must provision exactly like checkout.session.completed —
    the initial `completed` event arrives unpaid and is skipped."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    captured = _stub_provision(monkeypatch)

    email = "async-payer-test@example.com"
    body = _event(
        event_type="checkout.session.async_payment_succeeded",
        email=email,
        customer="cus_async_test_1",
    )
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200

    row = (
        await db_session.execute(
            text("SELECT stripe_id FROM user WHERE email = :email"),
            {"email": email},
        )
    ).first()
    assert row is not None, f"User row for {email} was not created"
    assert captured["payload"]["email"] == email

    await _cleanup(db_session, email=email)


@pytest.mark.asyncio
async def test_existing_stripe_id_is_preserved(client, db_session, monkeypatch):
    """A buyer whose Hub account already carries a stripe_id (e.g. an existing
    Workspace subscription) must keep it — the Lite checkout customer id must
    not clobber the original billing linkage."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    _stub_provision(monkeypatch)

    email = "existing-workspace-user@example.com"
    db_session.add(
        User(
            email=email,
            clean_email=email,
            password="Testpassword1!",  # noqa: S106
            stripe_id="cus_original_workspace",
        )
    )
    await db_session.commit()

    body = _event(email=email, customer="cus_new_lite_checkout")
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200

    row = (
        await db_session.execute(
            text("SELECT stripe_id FROM user WHERE email = :email"),
            {"email": email},
        )
    ).first()
    assert row.stripe_id == "cus_original_workspace"

    await _cleanup(db_session, email=email)


@pytest.mark.asyncio
async def test_null_stripe_id_is_backfilled(client, db_session, monkeypatch):
    """A pre-registered user with no stripe_id gets the checkout customer id."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)
    _stub_provision(monkeypatch)

    email = "preregistered-user-test@example.com"
    db_session.add(
        User(
            email=email,
            clean_email=email,
            password="Testpassword1!",  # noqa: S106
            stripe_id=None,
        )
    )
    await db_session.commit()

    body = _event(email=email, customer="cus_backfill_test_1")
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200

    row = (
        await db_session.execute(
            text("SELECT stripe_id FROM user WHERE email = :email"),
            {"email": email},
        )
    ).first()
    assert row.stripe_id == "cus_backfill_test_1"

    await _cleanup(db_session, email=email)


@pytest.mark.asyncio
async def test_duplicate_event_id_is_noop(client, db_session, monkeypatch):
    """Stripe redelivers events; the second delivery of the same event.id must
    return 200 without re-dispatching provisioning, and the audit table must
    hold exactly one row for the event."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)

    dispatches: list[dict] = []

    async def _fake_provision(*, function_name, payload, to_emails):
        dispatches.append(payload)

    monkeypatch.setattr(stripe_lite, "_provision_lite_install", _fake_provision)

    email = "duplicate-delivery-test@example.com"
    event_id = f"evt_dup_test_{uuid4().hex}"
    body = _event(email=email, customer="cus_dup_test_1", event_id=event_id)
    headers = {
        "stripe-signature": _sign(body),
        "content-type": "application/json",
    }

    first = await client.post("/stripe/webhook", content=body, headers=headers)
    second = await client.post("/stripe/webhook", content=body, headers=headers)
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == {"success": True}

    assert len(dispatches) == 1, "duplicate delivery must not re-provision"

    count = (
        await db_session.execute(
            text("SELECT COUNT(*) AS n FROM stripe_event WHERE event_id = :event_id"),
            {"event_id": event_id},
        )
    ).first()
    assert count.n == 1

    await _cleanup(db_session, email=email, event_id=event_id)


@pytest.mark.asyncio
async def test_unhandled_event_recorded_in_audit_table(client, db_session, monkeypatch):
    """Log-only events (e.g. checkout.session.expired) still land one audit
    row in stripe_event — the table is a record of every event received."""
    monkeypatch.setattr(config.settings, "STRIPE_WEBHOOK_SECRET", _TEST_SECRET)

    event_id = f"evt_audit_test_{uuid4().hex}"
    body = _event(
        event_type="checkout.session.expired",
        payment_status="unpaid",
        event_id=event_id,
    )
    response = await client.post(
        "/stripe/webhook",
        content=body,
        headers={
            "stripe-signature": _sign(body),
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200

    row = (
        await db_session.execute(
            text("SELECT type, livemode FROM stripe_event WHERE event_id = :event_id"),
            {"event_id": event_id},
        )
    ).first()
    assert row is not None, "unhandled event was not recorded in stripe_event"
    assert row.type == "checkout.session.expired"
    assert row.livemode == 0  # test events are livemode=false

    await _cleanup(db_session, event_id=event_id)
