"""Lite Checkout Stripe webhook — optional module.

This file is the entire footprint of the Stripe-driven Lite onboarding flow. It
is deliberately self-contained so it can be excluded from on-prem builds:

  - Build-time: delete this file. main.py imports it inside a try/except so the
    server starts normally without it; the /stripe/webhook route is simply not
    registered.
  - Runtime: keep the file, add "stripe_lite" to SUPPRESSED_API_ROUTERS in env.

Either way, no other module depends on anything declared here.
"""

import hashlib
import hmac
import json
from time import time
from typing import Annotated

import aioboto3
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api import base, schemas, stripe_schemas
from api.database import aget_write_db
from api.email import EmailService
from api.models import StripeEvent, User
from utilities import config

router = APIRouter(tags=["stripe_lite"])

# Lite is sold as a yearly plan only.
_LITE_SUBSCRIPTION_DAYS = 365
_LITE_LAMBDA_REGION = "us-east-1"

# Both carry the same checkout.session object. `completed` covers cards (paid
# immediately); `async_payment_succeeded` covers delayed methods (e.g. bank
# debits), whose `completed` event arrives unpaid and is skipped below.
_LITE_CHECKOUT_EVENTS = (
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
)


async def _invoke_lite_lambda(function_name: str, payload: dict) -> dict:
    """Invoke the provisioning lambda and return its response payload.

    The lambda is private — no Function URL. It is invoked through the AWS SDK,
    authorized by the pod's IAM role (lambda:InvokeFunction), so no extra auth
    is exchanged here.
    """
    session = aioboto3.Session()
    async with session.client(
        "lambda", region_name=_LITE_LAMBDA_REGION
    ) as lambda_client:
        response = await lambda_client.invoke(
            FunctionName=function_name,
            Payload=json.dumps(payload).encode(),
        )
        body = await response["Payload"].read()
        if response.get("FunctionError"):
            raise RuntimeError(f"lambda returned an error: {body!r}")
        result = json.loads(body)
        # The handler returns an API-Gateway-style {statusCode, headers, body}
        # envelope (kept so the dev Function URL serves real HTTP statuses).
        # A raw SDK invoke gets that envelope verbatim — unwrap it here.
        if "statusCode" not in result:
            return result
        if result["statusCode"] != 200:  # ruff:ignore[magic-value-comparison]
            raise RuntimeError(
                f"lambda returned {result['statusCode']}: {result.get('body')}"
            )
        return json.loads(result["body"])


async def _provision_lite_install(
    function_name: str, payload: dict, to_emails: list[str]
) -> None:
    """Background task: invoke the provisioning lambda, then email the credentials.

    Failures are logged only — the Stripe webhook has already responded 200 by
    the time this runs, so raising would orphan the request. Both this call and
    the lambda itself are expected to be idempotent on (email, stripe_id), so
    manual re-runs are safe.
    """
    try:
        # Lambda returns the install JSON directly as the response payload
        # (e.g. {"username": "...", "access_key_id": "...", "secret_access_key": "..."}).
        credentials = await _invoke_lite_lambda(function_name, payload)
        access_key_id = credentials.get("access_key_id")
        secret_access_key = credentials.get("secret_access_key")
        if not access_key_id or not secret_access_key:
            raise RuntimeError(
                f"lambda response missing credentials: keys={list(credentials)}"
            )
    except Exception as exc:
        logger.error(f"Lite provisioning lambda failed for {to_emails}: {exc}")
        return

    # First name for the greeting — fall back to "" so the template's
    # `{{#if first_name}}` branch picks the generic "there".
    first_name = (payload.get("full_name") or "").strip().split(" ")[0]

    for to_email in to_emails:
        try:
            EmailService.send_install_email(
                to=to_email,
                first_name=first_name,
                access_key_id=access_key_id,
                secret_access_key=secret_access_key,
                expiration=payload.get("expiration", ""),
                version=config.settings.OPENBB_LITE_DOCKER_TAG,
            )
        except Exception as exc:
            logger.error(f"Install email send failed for {to_email}: {exc}")


async def _handle_checkout_session(
    session: stripe_schemas.CheckoutSession,
    db: AsyncSession,
    background_tasks: BackgroundTasks,
) -> None:
    """Upsert the (email, stripe_id) User row and dispatch provisioning.

    Runs for both checkout event types in `_LITE_CHECKOUT_EVENTS`. The caller
    commits; nothing here does.
    """
    email = session.resolved_email()
    if not email or session.payment_status != "paid":
        logger.info(f"Stripe webhook: skipping unpaid/emailless checkout {session.id}")
        return
    existing = (await db.execute(select(User.uuid).where(User.email == email))).first()
    if existing:
        # User already exists (e.g. earlier checkout, or pre-registered).
        # Backfill stripe_id only if it's empty — an existing id is the
        # user's Workspace billing linkage and must not be clobbered.
        updated = await db.execute(
            update(User)
            .where(User.email == email, User.stripe_id.is_(None))
            .values(stripe_id=session.customer)
        )
        if updated.rowcount == 0:
            logger.info(
                f"Stripe webhook: {email} already has a stripe_id; "
                f"keeping it (checkout customer {session.customer})"
            )
    else:
        # `password` is non-nullable so we set a random one; access is granted
        # downstream by the provisioning lambda, not by this row.
        await db.execute(
            insert(User).values(
                email=email,
                clean_email=base.clean_email(email),
                password=base.random_password(),
                stripe_id=session.customer,
            )
        )

    # Provisioning runs as a background task (after the route's commit and the
    # response) so we return 200 to Stripe well inside its 10s window even if
    # the lambda cold-starts. Skips are logged but never raise.
    function_name = config.settings.LITE_LAMBDA_FUNCTION_NAME
    if not function_name:
        logger.warning(
            f"LITE_LAMBDA_FUNCTION_NAME not set; skipping provisioning for {email}"
        )
        return
    # Install credentials always go to the purchaser; Checkout may also
    # collect a dedicated admin/technical contact, who gets a copy when the
    # address differs. The dashboard-created custom field's key is `adminemail`
    # (no underscore); `admin_email` is accepted too in case the link is
    # recreated via the API.
    to_emails = [email]
    admin_email = session.custom_field("adminemail") or session.custom_field(
        "admin_email"
    )
    if admin_email and admin_email.lower() != email.lower():
        to_emails.append(admin_email)

    # Names come from Stripe's native name collection: individual_name is the
    # buyer, business_name the company — customer_details.name mirrors the
    # business name when business collection is on, so it's only a fallback.
    background_tasks.add_task(
        _provision_lite_install,
        function_name=function_name,
        payload={
            "full_name": session.individual_name() or session.customer_name() or "",
            "business_name": session.business_name()
            or session.custom_field("business_name")
            or "",
            "email": email,
            "expiration": base.get_day(_LITE_SUBSCRIPTION_DAYS).date().isoformat(),
            "subscription_tier": "yearly",
        },
        to_emails=to_emails,
    )


def _handle_renewal_invoice(
    invoice: stripe_schemas.Invoice, background_tasks: BackgroundTasks
) -> None:
    """Dispatch a lambda renewal for a paid subscription-cycle invoice.

    Anything that isn't a paid renewal is a logged no-op: `subscription_create`
    is the first payment — checkout.session.completed already provisions it,
    so invoking the lambda again would double-issue.
    """
    if invoice.billing_reason != "subscription_cycle" or not invoice.paid:
        logger.info(
            f"Stripe webhook: invoice.paid {invoice.id} "
            f"(billing_reason={invoice.billing_reason}); no-op"
        )
        return
    email = invoice.customer_email
    if not email:
        logger.warning(
            f"Stripe webhook: renewal invoice {invoice.id} has no customer "
            f"email; skipping renewal"
        )
        return
    function_name = config.settings.LITE_LAMBDA_FUNCTION_NAME
    if not function_name:
        logger.warning(
            f"LITE_LAMBDA_FUNCTION_NAME not set; skipping renewal for {email}"
        )
        return
    background_tasks.add_task(
        _renew_lite_install,
        function_name=function_name,
        payload={
            "full_name": invoice.customer_name or "",
            "business_name": "",
            "email": email,
            "expiration": base.get_day(_LITE_SUBSCRIPTION_DAYS).date().isoformat(),
            "subscription_tier": "yearly",
            "is_renewal": True,
        },
    )


async def _renew_lite_install(*, function_name: str, payload: dict) -> None:
    """Background task: invoke the provisioning lambda in renewal mode.

    With `"is_renewal": true` the lambda extends the existing user's expiration
    (matched by email) instead of provisioning a new install — no credentials
    come back and no email is sent. Failures are logged only, same rationale as
    `_provision_lite_install`.
    """
    email = payload.get("email")
    try:
        await _invoke_lite_lambda(function_name, payload)
        logger.info(f"Lite renewal processed for {email}")
    except Exception as exc:
        logger.error(f"Lite renewal lambda failed for {email}: {exc}")


def _verify_stripe_signature(
    payload: bytes, sig_header: str | None, secret: str, tolerance: int
) -> bool:
    """Verify a Stripe webhook signature without the stripe SDK.

    Stripe sends `Stripe-Signature: t=<ts>,v1=<hex>[,v1=<hex>...]`. The signed
    payload is `f"{t}.{raw_body}"`, HMAC-SHA256 keyed by the webhook secret.
    Multiple v1 entries are possible during secret rotation.
    """
    if not sig_header:
        return False
    pairs = [item.split("=", 1) for item in sig_header.split(",") if "=" in item]
    timestamp = next((v for k, v in pairs if k == "t"), None)
    if timestamp is None:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(int(time()) - ts) > tolerance:
        return False
    signed = f"{timestamp}.{payload.decode('utf-8')}".encode()
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return any(k == "v1" and hmac.compare_digest(expected, v) for k, v in pairs)


@router.post("/stripe/webhook", response_model=schemas.SuccessReturn)
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
):
    """Lite Checkout webhook: records the (email, stripe_id) pair on first payment.

    Verifies the Stripe signature, records the event in `stripe_event` (whose
    unique event_id makes Stripe's redeliveries no-ops), then on a paid
    checkout (`checkout.session.completed`, or
    `checkout.session.async_payment_succeeded` for delayed payment methods)
    upserts a User row holding only `email` and `stripe_id`. Actual access
    provisioning (ECR download, license, etc.) is the job of a separate Lambda
    invoked elsewhere — this endpoint deliberately does not flip billing flags,
    confirm the user, or set `pro_start`.

    On `invoice.paid` with `billing_reason == "subscription_cycle"` (a
    renewal — the first payment's invoice arrives as `subscription_create` and
    is ignored, checkout handles it) the same lambda is invoked with
    `"is_renewal": true`, which pushes the existing user's expiration out
    another year. No email is sent for renewals.

    All other configured events (checkout.session.expired,
    checkout.session.async_payment_failed, customer.subscription.updated,
    customer.subscription.deleted) are logged and recorded only.
    """
    secret = config.settings.STRIPE_WEBHOOK_SECRET
    if not secret:
        logger.error("STRIPE_WEBHOOK_SECRET not configured; rejecting webhook")
        raise HTTPException(503, detail="Webhook not configured")

    payload = await request.body()
    if not _verify_stripe_signature(
        payload,
        request.headers.get("stripe-signature"),
        secret,
        config.settings.STRIPE_WEBHOOK_TOLERANCE_SECONDS,
    ):
        raise HTTPException(400, detail="Invalid Stripe signature")

    try:
        event = stripe_schemas.GeneralRequest(**json.loads(payload))
    except Exception as exc:
        logger.error(f"Stripe webhook: malformed event: {exc}")
        raise HTTPException(400, detail="Malformed event") from exc

    # Record the event before acting on it — every verified event lands one
    # audit row. The unique event_id doubles as the dedupe key: Stripe
    # redelivers events, and a conflicting insert means this one was already
    # handled, so ack and stop. The row commits with the rest of the handler's
    # writes below — if processing fails, the rollback un-records the event
    # and Stripe's retry gets a clean run.
    try:
        await db.execute(
            insert(StripeEvent).values(
                event_id=event.id, type=event.type, livemode=event.livemode
            )
        )
    except IntegrityError:
        await db.rollback()
        logger.info(f"Stripe webhook: duplicate delivery of {event.id}; ignoring")
        return {"success": True}

    if event.type in _LITE_CHECKOUT_EVENTS:
        await _handle_checkout_session(
            event.to_checkout_session(), db, background_tasks
        )
    elif event.type == "invoice.paid":
        _handle_renewal_invoice(event.to_invoice(), background_tasks)
    else:
        logger.info(f"Stripe webhook: received {event.type} (id={event.id}); no-op")

    await db.commit()
    return {"success": True}
