import platform
from contextlib import asynccontextmanager, suppress
from time import time
from typing import Annotated
from uuid import UUID

import prometheus_client
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi_pagination import add_pagination
from loguru import logger
from prometheus_fastapi_instrumentator import Instrumentator, metrics
from slowapi import _rate_limit_exceeded_handler  # noqa: PLC2701
from slowapi.errors import RateLimitExceeded
from sqlalchemy import Row, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.cors import CORSMiddleware

from api import (
    auth_helpers,
    helpers,
    hubspot,
    schemas,
    stripe_schemas,
)
from api.context import session_token_ctx
from api.database import aget_write_db
from api.email import EmailService
from api.events.role_permission_events import init_audit_listeners
from api.models import Entity
from api.rate_limit import LIMIT_DEFAULT, exempt_user_agent, limiter
from api.worker_tasks import start_background_tasks
from routers import (
    admin,
    auth,
    entity,
    marketplace,
    marketplace_developer,
    metrics as metrics_router,
    run_tasks,
    sdk,
    testing,
)
from routers.pro import (
    dash,
    data_connectors,
    file_storage,
    index,
    user_apps,
    workspace_mcp,
)
from routers.pro.workspace_mcp.asgi import create_workspace_mcp_asgi_app

# Optional Lite Checkout module. Delete routers/stripe_lite.py for builds that
# should not ship the Stripe webhook (e.g. on-prem customer deploys); the
# server starts normally without it.
try:
    from routers import stripe_lite  # type: ignore[attr-defined]
except ImportError:
    stripe_lite = None
from utilities import config
from utilities.feedback_providers import get_feedback_provider
from utilities.runtime_metrics import start_runtime_metrics

config.settings.setup_logging()
logger.info("START")
logger.info(f"Python: {platform.python_version()}")
logger.info(f"OS: {platform.system()}")

FASTAPI_KWARGS = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await helpers.init_trial_mappings()
    await start_background_tasks()
    await init_audit_listeners()
    if config.settings.PROMETHEUS:
        start_runtime_metrics()
    yield


if config.settings.DISABLE_CORS:
    logger.warning("Running with CORS Allow ALL, this should NOT be set in production")
    origins = ["*"]
else:
    origins = config.settings.BACKEND_CORS_ORIGINS

workspace_mcp_asgi_app = create_workspace_mcp_asgi_app(lifespan)

app = FastAPI(
    redoc_url=None,
    docs_url=None,
    openapi_url=None,
    lifespan=workspace_mcp_asgi_app.lifespan,
    generate_unique_id_function=lambda route: route.name,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


ns = {"metric_namespace": "payment_backend", "metric_subsystem": "fastapi"}

if config.settings.PROMETHEUS:
    instrumentator = Instrumentator(should_group_status_codes=False)
    instrumentator.add(metrics.requests(**ns))  # type: ignore
    instrumentator.add(metrics.response_size(**ns))  # type: ignore
    instrumentator.add(metrics.latency(buckets=(1, 2, 3, 4), **ns))  # type: ignore
    instrumentator.instrument(app)


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

routers = [
    auth.router,
    metrics_router.router,
    sdk.router,
    index.router,
    data_connectors.router,
    file_storage.router,
    dash.router,
    user_apps.router,
    workspace_mcp.router,
    entity.router,
    admin.router,
    marketplace.router,
    marketplace_developer.router,
    run_tasks.router,
    testing.router,
]
if stripe_lite is not None and not config.settings.is_onprem():
    # gate for making sure onprem doesnt get it - even with a misconfigure
    logger.info("Stripe Lite router is enabled", exclude=True)
    routers.append(stripe_lite.router)


@app.exception_handler(Exception)
async def api_exception_handler(request: Request, exc: Exception):
    helpers.add_log(request.url.path, str(exc), 500, request.method)
    extras = dict(
        method=request.method,
        path=request.url.path,
        status_code=499,
    )
    logger.bind(**extras).exception(exc)
    return JSONResponse(
        status_code=499, content={"detail": "unexpected error", "status": 499}
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    helpers.add_log(request.url.path, exc.detail, exc.status_code, request.method)
    extras = dict(
        method=request.method,
        path=request.url.path,
        status_code=exc.status_code,
    )
    logger.bind(**extras).exception(exc)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status": exc.status_code},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: HTTPException):
    detail = "Error extracting validation details"
    try:
        extras = dict(
            method=request.method,
            path=request.url.path,
            status_code=422,
        )
        logger.bind(**extras).exception(exc)

        if not getattr(request, "_stream_consumed", False):
            body = await request.body()
            decoded = body.decode("utf-8")
            if decoded:
                logger.bind(**extras).error(f"\nRequest body: {decoded}")

        error = exc.errors()[0]  # type: ignore
        detail = error["msg"].replace("Value error, ", "")
    except Exception as log_exc:
        logger.bind(**extras).exception(log_exc)

    return JSONResponse(status_code=422, content={"detail": detail, "status": 422})


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time()

    if forwarded_proto := request.headers.get("x-forwarded-proto"):
        # Override the internal scope scheme so url_for and redirects use it
        request.scope["scheme"] = forwarded_proto

    # Get token using the same logic as oauth2_scheme
    scheme, raw_token = auth_helpers.get_authorization_scheme_param(
        request.headers.get("Authorization")
    )
    token = None

    if scheme.lower() == "bearer":
        with suppress(ValueError, TypeError):
            clean_token = UUID(raw_token)
            token = session_token_ctx.set(clean_token)

    try:
        response: Response = await call_next(request)
    except Exception as exc:
        process_time = (time() - start_time) * 1000
        logger.bind(
            method=request.method,
            path=request.url.path,
            status_code=500,
            response_time=process_time,
        ).exception(exc)
        return JSONResponse(
            status_code=400,
            content={"detail": "unexpected error", "status": 400},
        )
    finally:
        # Clean up the context var if we set it - avoid context leaks between requests
        if token:
            session_token_ctx.reset(token)

    process_time = (time() - start_time) * 1000
    response.headers["X-Process-Time"] = str(process_time)
    extras = dict(
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        response_time=process_time,
    )
    if request.method != "OPTIONS":
        logger.info(
            f'"{request.method} path={request.url.path} completed_in={process_time:.2f}ms" {response.status_code}',  # noqa: E501
            **extras,
        )

    return response


@app.get("/openapi.json")
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def openapi(request: Request, _=Depends(auth_helpers.get_current_superuser)):
    return get_openapi(title="FastAPI", version="1.0.0", routes=app.routes)


@app.get("/health")
@app.get("/healthz")
@app.get("/")
def nginx():
    "This endpoint only exists to test NGINX"
    return JSONResponse(content={"success": True}, status_code=200)


@app.post("/invite-emails", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
def send_invite_emails(
    request: Request,
    invite: schemas.InviteEmail,
    background_tasks: BackgroundTasks,
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["email"]))],
):
    if not config.settings.HUBSPOT:
        raise HTTPException(400, detail=hubspot.ERROR_MESSAGE)

    background_tasks.add_task(
        EmailService.send_invite_emails,
        user.email,
        invite.to_emails,
    )
    return {"success": True}


@app.post("/feedback", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def post_feedback(
    request: Request,
    feedback: schemas.Feedback,
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["email"]))],
    db: Annotated[AsyncSession, Depends(aget_write_db)],
):
    provider = get_feedback_provider()
    success, message = await provider.submit_feedback(feedback, user.email, db, None)

    if success:
        return JSONResponse(content={"success": True}, status_code=200)

    # Return 400 with the error message from the provider or default HTTP error if it failed
    if message == hubspot.ERROR_MESSAGE:
        raise HTTPException(400, detail=message)

    return JSONResponse(content={"success": False, "message": message}, status_code=400)


@app.post("/stripe", response_model=schemas.SuccessReturn)
async def stripe(
    data: stripe_schemas.GeneralRequest,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
):
    if data.type == "invoice.sent":
        invoice = data.to_invoice()
        if invoice.due_date:
            # We should consider setting to period_end if paid is true
            # We should consider only updating if the new value is higher
            update_query = (
                update(Entity)
                .where(Entity.stripe_id == invoice.customer)
                .values(expiration_date=invoice.due_date)
            )
            response = await db.execute(update_query)
            if response.rowcount == 0:
                logger.info(f"Could not find id: {invoice.customer}")
            await db.commit()
    elif data.type == "invoice.paid":
        invoice = data.to_invoice()
        # We should consider only updating if the new value is higher
        update_query = (
            update(Entity)
            .where(Entity.stripe_id == invoice.customer)
            .values(expiration_date=invoice.lines.data[0].period.end)
        )
        response = await db.execute(update_query)
        if response.rowcount == 0:
            logger.error(f"Could not find id: {invoice.customer}")
        await db.commit()
    return {"success": True}


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    BLOCKED = [
        "/pro/register",
        "/pro/book-demo",
        "/pro/log",
        "/pro/create-user/{the_uuid}",
        "/pro/create-account/{the_uuid}",
        "/pro/extend-trial-email/{user_uuid}",
        "/pro/check-install/{target}",
        "/pro/check-update/{target}/{current_version}",
    ]

    openapi_schema = get_openapi(
        title="OpenBB Payments Backend",
        version="1.0.0",
        servers=[
            {
                "url": config.settings.SELFURL,
                "description": "Development server",
            },
        ],
        routes=[
            route
            for route in app.routes
            if hasattr(route, "path")
            and route.path.startswith("/pro/")
            and route.path not in BLOCKED
        ],
    )
    app.openapi_schema = openapi_schema
    return app.openapi_schema


def include_routers():
    active_routers = []
    for router in routers:
        # Supress routers
        if not any(
            tag in config.settings.SUPPRESSED_API_ROUTERS for tag in router.tags
        ):
            active_routers.extend(router.tags)
            app.include_router(router)

    # Include router
    logger.info(f"Included routers: {active_routers}", exclude=True)

    # Supress routes
    routes_to_remove = [
        route
        for route in app.routes
        if hasattr(route, "path")
        and route.path in config.settings.SUPPRESSED_API_ROUTES
    ]
    for route in routes_to_remove:
        app.routes.remove(route)


def start_prometheus(fork_id: int):
    "Start prometheus server"
    if fork_id == 1:
        logger.info("Starting prometheus server")
        prometheus_client.start_http_server(6970)


include_routers()
if config.settings.PROMETHEUS:
    # Register /metrics before the catch-all MCP mount below, otherwise the mount
    # (matched first) shadows it and returns the MCP credential error.
    instrumentator.expose(app, endpoint="/metrics", should_gzip=True)
app.mount("", workspace_mcp_asgi_app, name="Workspace MCP App")
add_pagination(app)


app.openapi = custom_openapi  # type: ignore


app.add_middleware(GZipMiddleware)

# Added last so it is the outermost middleware: it answers the CORS preflight
# for the public marketplace paths before the restrictive global CORSMiddleware
# can reject a non-allowlisted origin (e.g. localhost).
app.add_middleware(auth_helpers.PublicCORSMiddleware)
