"""seed data - tiers, tier defaults, and data bundles

Inserts reference/configuration data required for the application.
Skips if data already exists (i.e., existing databases that were stamped).

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-23

"""

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
import sqlalchemy_utils

from alembic import op
from api.models.model_helpers import JSONType  # type: ignore

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # Skip if seed data already exists
    result = bind.execute(sa.text("SELECT COUNT(*) FROM tier")).scalar()
    if result and result > 0:
        return

    now = datetime.now(UTC).replace(tzinfo=None)

    # --- tier ---
    tier = sa.table(
        "tier",
        sa.column("id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("has_trial", sa.Boolean),
        sa.column("trial_duration_days", sa.Integer),
        sa.column("created_date", sa.DateTime),
        sa.column("updated_date", sa.DateTime),
    )
    op.bulk_insert(
        tier,
        [
            {
                "id": 1,
                "name": "Pro",
                "has_trial": True,
                "trial_duration_days": 21,
                "created_date": now,
                "updated_date": now,
            },
            {
                "id": 2,
                "name": "Terminal",
                "has_trial": False,
                "trial_duration_days": None,
                "created_date": now,
                "updated_date": now,
            },
        ],
    )

    # --- default_tier ---
    default_tier = sa.table(
        "default_tier",
        sa.column("uuid", sqlalchemy_utils.types.uuid.UUIDType()),
        sa.column("tier_id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("number_copilot_calls_day", sa.Integer),
        sa.column("total_file_upload_size_gb", sa.Integer),
        sa.column("share_widgets", sa.String),
        sa.column("data_bundle", sa.Boolean),
        sa.column("bring_your_own_data", sa.Boolean),
        sa.column("bring_your_own_copilot", sa.Boolean),
        sa.column("admin_access", sa.Boolean),
        sa.column("support", sa.Boolean),
        sa.column("excel_add_in", sa.Boolean),
        sa.column("data_add_ons_redistribution", sa.Boolean),
        sa.column("created_date", sa.DateTime),
        sa.column("updated_date", sa.DateTime),
    )
    op.bulk_insert(
        default_tier,
        [
            {
                "uuid": uuid4(),
                "tier_id": 1,
                "name": "ProDefaults",
                "number_copilot_calls_day": 100,
                "total_file_upload_size_gb": 100,
                "share_widgets": "public",
                "data_bundle": True,
                "bring_your_own_data": True,
                "bring_your_own_copilot": True,
                "admin_access": True,
                "support": True,
                "excel_add_in": True,
                "data_add_ons_redistribution": True,
                "created_date": now,
                "updated_date": now,
            },
            {
                "uuid": uuid4(),
                "tier_id": 2,
                "name": "TerminalDefaults",
                "number_copilot_calls_day": 20,
                "total_file_upload_size_gb": 1,
                "share_widgets": "private",
                "data_bundle": False,
                "bring_your_own_data": False,
                "bring_your_own_copilot": False,
                "admin_access": False,
                "support": False,
                "excel_add_in": False,
                "data_add_ons_redistribution": False,
                "created_date": now,
                "updated_date": now,
            },
        ],
    )

    # --- data_bundle (3 bundles: Default, Equity Research, Pro Trial) ---
    data_bundle = sa.table(
        "data_bundle",
        sa.column("uuid", sqlalchemy_utils.types.uuid.UUIDType()),
        sa.column("bundle_name", sa.String),
        sa.column("except_widgets", JSONType()),
        sa.column("except_dashboard_templates", JSONType()),
        sa.column("except_team_collaboration", JSONType()),
        sa.column("excel_add_in", sa.Boolean),
        sa.column("data_export", sa.Boolean),
        sa.column("providers", JSONType()),
        sa.column("dashboards_at_launch", JSONType()),
        sa.column("my_dashboards", JSONType()),
        sa.column("invite_your_colleagues", sa.Boolean),
        sa.column("number_copilot_calls_day", sa.Integer),
        sa.column("total_file_upload_size_gb", sa.Integer),
        sa.column("allow_custom_backends", sa.Boolean),
        sa.column("created_date", sa.DateTime),
        sa.column("updated_date", sa.DateTime),
    )

    common_my_dashboards = [
        "onboarding",
        "news",
        "charting",
        "equity",
        "equityAnalyst",
        "calendars",
        "countryEconomics",
    ]

    full_dashboards_at_launch = [
        "onboarding",
        "charting",
        "news",
        "equity",
        "equityAnalyst",
        "calendars",
        "etfTemplate",
    ]

    op.bulk_insert(
        data_bundle,
        [
            # Default bundle (free tier)
            {
                "uuid": uuid4(),
                "bundle_name": "Default",
                "except_widgets": [
                    "etf_holdings",
                    "economic_calendar",
                    "earnings_trends",
                    "revenue_trends",
                    "etf_classification",
                    "etf_characteristics",
                ],
                "except_dashboard_templates": ["etfTemplate"],
                "except_team_collaboration": ["pdf_reports", "sharing"],
                "excel_add_in": False,
                "data_export": False,
                "providers": ["fmp", "econdb", "benzinga"],
                "dashboards_at_launch": [
                    "onboarding",
                    "charting",
                    "news",
                    "equity",
                    "equityAnalyst",
                    "calendars",
                ],
                "my_dashboards": common_my_dashboards,
                "invite_your_colleagues": True,
                "number_copilot_calls_day": 20,
                "total_file_upload_size_gb": 1,
                "allow_custom_backends": True,
                "created_date": now,
                "updated_date": now,
            },
            # Equity Research bundle (paid tier)
            {
                "uuid": uuid4(),
                "bundle_name": "Equity Research",
                "except_widgets": [],
                "except_dashboard_templates": [],
                "except_team_collaboration": [],
                "excel_add_in": True,
                "data_export": True,
                "providers": None,
                "dashboards_at_launch": full_dashboards_at_launch,
                "my_dashboards": common_my_dashboards,
                "invite_your_colleagues": False,
                "number_copilot_calls_day": 100,
                "total_file_upload_size_gb": 10,
                "allow_custom_backends": True,
                "created_date": now,
                "updated_date": now,
            },
            # Pro Trial bundle
            {
                "uuid": uuid4(),
                "bundle_name": "Pro Trial",
                "except_widgets": [],
                "except_dashboard_templates": [],
                "except_team_collaboration": [],
                "excel_add_in": True,
                "data_export": True,
                "providers": None,
                "dashboards_at_launch": full_dashboards_at_launch,
                "my_dashboards": common_my_dashboards,
                "invite_your_colleagues": False,
                "number_copilot_calls_day": 100,
                "total_file_upload_size_gb": 100,
                "allow_custom_backends": True,
                "created_date": now,
                "updated_date": now,
            },
        ],
    )


def downgrade():
    # Seed data removal is handled by the baseline's drop_all
    op.execute(sa.text("DELETE FROM data_bundle"))
    op.execute(sa.text("DELETE FROM default_tier"))
    op.execute(sa.text("DELETE FROM tier"))
