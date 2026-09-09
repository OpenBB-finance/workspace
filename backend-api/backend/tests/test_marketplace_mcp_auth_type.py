"""MCP servers on a marketplace listing: auth strategy, input validation, and
the stored-vs-manifest precedence.

`mcp_servers` can come from two places — a developer-declared column set at
submission time, or the `mcp_servers` block of the vendor's cached apps.json.
Stored config wins; the manifest is the fallback. Either way the per-server
auth strategy has to survive serialization so the frontend knows whether to run
OAuth or prompt for a static token.
"""

import pytest
from pydantic import ValidationError

from api.marketplace_schemas import (
    AdminAppResponse,
    AppMCPServer,
    AppMCPServerInput,
    DeveloperAppResponse,
    MarketplaceAppResponse,
    get_mcp_servers,
)


def test_get_mcp_servers_reads_snake_and_camel_keys():
    entry = {"name": "Acme", "url": "https://mcp.acme.com/mcp"}
    assert get_mcp_servers([{"mcp_servers": [entry]}]) == [entry]
    assert get_mcp_servers([{"mcpServers": [entry]}]) == [entry]


def test_get_mcp_servers_handles_missing_cache():
    assert get_mcp_servers(None) == []
    assert get_mcp_servers([]) == []
    assert get_mcp_servers(["not-a-dict"]) == []
    assert get_mcp_servers([{"name": "no mcp servers here"}]) == []


def test_auth_type_survives_round_trip_from_camel_case():
    server = AppMCPServer.model_validate(
        {
            "name": "Acme Research MCP",
            "description": "Query Acme research data via MCP tools.",
            "url": "https://mcp.acmedata.com/mcp",
            "authType": "token",
        }
    )
    assert server.auth_type == "token"
    assert server.model_dump(by_alias=True)["authType"] == "token"


def test_auth_type_accepts_snake_case_from_apps_json():
    server = AppMCPServer.model_validate(
        {"name": "Acme", "url": "https://mcp.acme.com/mcp", "auth_type": "token"}
    )
    assert server.auth_type == "token"


def test_auth_type_defaults_to_none_when_absent():
    """Absent means "use the default OAuth flow" — the frontend treats anything
    other than "token" as OAuth, so no default value is invented here."""
    server = AppMCPServer.model_validate(
        {"name": "Acme", "url": "https://mcp.acme.com/mcp"}
    )
    assert server.auth_type is None
    assert server.model_dump(by_alias=True)["authType"] is None


def test_oauth_is_accepted_explicitly():
    server = AppMCPServer.model_validate(
        {"name": "Acme", "url": "https://mcp.acme.com/mcp", "authType": "oauth"}
    )
    assert server.auth_type == "oauth"


def test_unknown_auth_type_degrades_to_oauth_instead_of_raising():
    """apps.json is vendor-controlled and `/marketplace/apps` validates every app
    in one pass, so a single typo must not 500 the whole listing."""
    for bad in ("basic", "Token", "", 1, [], {"a": 1}):
        server = AppMCPServer.model_validate(
            {"name": "Acme", "url": "https://mcp.acme.com/mcp", "authType": bad}
        )
        assert server.auth_type is None, bad


# --- Request-side schema (AppMCPServerInput) ---------------------------------


def test_input_accepts_camel_and_snake_auth_type():
    """apps.json documents `authType`; our own request body sends `auth_type`."""
    assert (
        AppMCPServerInput.model_validate(
            {"name": "Acme", "url": "https://mcp.acme.com/mcp", "authType": "token"}
        ).auth_type
        == "token"
    )
    assert (
        AppMCPServerInput.model_validate(
            {"name": "Acme", "url": "https://mcp.acme.com/mcp", "auth_type": "token"}
        ).auth_type
        == "token"
    )


def test_input_rejects_unknown_auth_type_instead_of_degrading():
    """The opposite of the response model on purpose: a typo in a request body
    is the caller's mistake and should 422, not silently become OAuth."""
    for bad in ("basic", "Token", "", 1, [], {"a": 1}):
        with pytest.raises(ValidationError):
            AppMCPServerInput.model_validate(
                {"name": "Acme", "url": "https://mcp.acme.com/mcp", "authType": bad}
            )


def test_input_rejects_blank_name_or_url():
    with pytest.raises(ValidationError):
        AppMCPServerInput.model_validate({"name": "  ", "url": "https://mcp.acme.com"})
    with pytest.raises(ValidationError):
        AppMCPServerInput.model_validate({"name": "Acme", "url": ""})


# --- Stored-vs-manifest precedence -------------------------------------------

STORED = [{"name": "Stored", "url": "https://stored.example.com/mcp", "auth_type": "token"}]
MANIFEST = [{"mcp_servers": [{"name": "Manifest", "url": "https://manifest.example.com/mcp"}]}]


class _AppStub:
    """Minimal stand-in for a VendorApp row (the response is from_attributes)."""

    def __init__(self, mcp_servers=None, apps_json_cache=None):
        self.uuid = "11111111-1111-1111-1111-111111111111"
        self.vendor_uuid = "22222222-2222-2222-2222-222222222222"
        self.name = "Acme App"
        self.short_description = "An app"
        self.vendor = type(
            "_Vendor",
            (),
            {
                "name": "Acme",
                "description": None,
                "website_url": None,
                "thumbnail_url": None,
                "support_email": None,
                "documentation_url": None,
            },
        )()
        self.mcp_servers = mcp_servers
        self.apps_json_cache = apps_json_cache
        self.widgets_json_cache = None
        self.status = "published"
        self.ratings = []
        self.screenshots = []
        self.version = "1"
        self.is_built_in = False
        self.auth_type = ["api_key"]
        self.auth_fields = None
        for attr in (
            "parent_app_uuid",
            "category",
            "tagline",
            "backend_base_url",
            "thumbnail_url",
            "thumbnail_url_dark",
            "thumbnail_url_light",
            "api_key_url",
            "api_key_info_url",
            "rejection_reason",
            "last_fetch_status",
            "last_fetch_error",
            "created_date",
            "updated_date",
            "more_information_url",
            "apps_json_url",
            "widgets_json_url",
            "last_fetched_at",
            "last_verified_at",
        ):
            setattr(self, attr, None)


def _names(response):
    return [s.name for s in response.mcp_servers]


def test_stored_servers_win_over_the_manifest():
    app = MarketplaceAppResponse.model_validate(_AppStub(STORED, MANIFEST))
    assert _names(app) == ["Stored"]
    assert app.mcp_servers[0].auth_type == "token"


@pytest.mark.parametrize("stored", [None, []])
def test_empty_stored_falls_back_to_the_manifest(stored):
    """`[]` is how a developer clears the override — it must not mean "no MCP"."""
    app = MarketplaceAppResponse.model_validate(_AppStub(stored, MANIFEST))
    assert _names(app) == ["Manifest"]


def test_no_stored_and_no_manifest_yields_empty_list():
    assert MarketplaceAppResponse.model_validate(_AppStub()).mcp_servers == []


def test_malformed_manifest_entries_are_skipped_not_raised():
    """One vendor's broken apps.json must not 500 the whole catalog."""
    cache = [
        {
            "mcp_servers": [
                {"name": "MissingUrl"},
                "not-a-dict",
                {"name": "Good", "url": "https://good.example.com/mcp", "authType": []},
            ]
        }
    ]
    app = MarketplaceAppResponse.model_validate(_AppStub(None, cache))
    assert _names(app) == ["Good"]
    assert app.mcp_servers[0].auth_type is None


def test_mcp_servers_serializes_as_camel_case():
    dumped = MarketplaceAppResponse.model_validate(_AppStub(STORED)).model_dump(
        by_alias=True
    )
    assert dumped["mcpServers"][0]["authType"] == "token"


# --- Developer response keeps stored and merged values distinct ---------------


def test_developer_response_exposes_stored_servers_separately():
    """The submission dialog seeds its MCP section from `storedMcpServers`.
    Seeding from the merged `mcpServers` would silently promote a
    manifest-derived server into stored config on the next PATCH.
    """
    derived = DeveloperAppResponse.model_validate(_AppStub(None, MANIFEST))
    assert _names(derived) == ["Manifest"]
    assert derived.stored_mcp_servers is None

    stored = DeveloperAppResponse.model_validate(_AppStub(STORED, MANIFEST))
    assert [s.name for s in stored.stored_mcp_servers] == ["Stored"]


def test_developer_response_serializes_stored_servers_as_camel_case():
    dumped = DeveloperAppResponse.model_validate(_AppStub(STORED)).model_dump(
        by_alias=True
    )
    assert dumped["storedMcpServers"][0]["name"] == "Stored"


# --- Admin review response ----------------------------------------------------
# Reviewers judge the listing users will actually get, so the admin response
# carries the same merged value as the public catalog — not the raw column.


def test_admin_response_applies_the_same_precedence():
    assert _names(AdminAppResponse.model_validate(_AppStub(STORED, MANIFEST))) == [
        "Stored"
    ]
    assert _names(AdminAppResponse.model_validate(_AppStub(None, MANIFEST))) == [
        "Manifest"
    ]
    assert AdminAppResponse.model_validate(_AppStub()).mcp_servers == []


def test_admin_response_skips_malformed_manifest_entries():
    cache = [{"mcp_servers": [{"name": "MissingUrl"}, "not-a-dict"]}]
    assert AdminAppResponse.model_validate(_AppStub(None, cache)).mcp_servers == []


def test_admin_response_keeps_snake_case_keys_but_camel_servers():
    """`AdminAppResponse` is the one marketplace response the frontend reads as
    snake_case, but `AppMCPServer` carries its own camel config — the nested
    server keeps `authType` so it maps onto the shared `ListedAppMcpServer`."""
    dumped = AdminAppResponse.model_validate(_AppStub(STORED)).model_dump(by_alias=True)
    assert "mcp_servers" in dumped
    assert dumped["mcp_servers"][0]["authType"] == "token"
