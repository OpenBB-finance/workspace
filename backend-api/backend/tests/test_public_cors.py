"""Tests for the public-path CORS middleware.

These verify that the explicitly whitelisted public endpoints reflect `*` for
any origin (including localhost) and answer the CORS preflight directly, while
every other path is left untouched for the global CORSMiddleware to handle.
"""

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from api.auth_helpers import PublicCORSMiddleware


def _build_app() -> Starlette:
    async def marketplace_apps(_request):
        return JSONResponse([])

    async def other(_request):
        return JSONResponse({})

    app = Starlette(
        routes=[
            Route("/marketplace/apps", marketplace_apps, methods=["GET", "OPTIONS"]),
            Route("/pro/secret", other, methods=["GET", "OPTIONS"]),
        ]
    )
    app.add_middleware(PublicCORSMiddleware)
    return app


class TestPublicCORSMiddleware:
    def test_preflight_public_path_allows_any_origin(self):
        client = TestClient(_build_app())
        resp = client.options(
            "/marketplace/apps",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert resp.headers["access-control-allow-origin"] == "*"
        assert "GET" in resp.headers["access-control-allow-methods"]

    def test_get_public_path_sets_cors_header(self):
        client = TestClient(_build_app())
        resp = client.get(
            "/marketplace/apps",
            headers={"Origin": "http://localhost:3000"},
        )
        assert resp.status_code == 200
        assert resp.headers["access-control-allow-origin"] == "*"

    def test_non_public_path_untouched(self):
        client = TestClient(_build_app())
        resp = client.get(
            "/pro/secret",
            headers={"Origin": "http://localhost:3000"},
        )
        assert resp.status_code == 200
        assert "access-control-allow-origin" not in resp.headers
