"""add rejection_reason, microsoft_id, stripe_event audit table

Revision ID: 5c8f2e91d0a3
Revises: 0003
Create Date: 2026-07-17

"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from alembic import op  # type: ignore

# revision identifiers, used by Alembic.
revision = "5c8f2e91d0a3"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    # No exists-guard needed (unlike 0003): stripe_event was
    # added after the baseline was frozen, so no DB can already have it.

    op.add_column("vendor_app", sa.Column("rejection_reason", sa.Text(), nullable=True))

    op.create_table(
        "stripe_event",
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("livemode", sa.Boolean(), nullable=False),
        sa.Column("uuid", UUIDType(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("updated_date", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("uuid"),
        sa.UniqueConstraint("event_id", name="uq_stripe_event_event_id"),
    )
    op.add_column(
        "user", sa.Column("microsoft_id", sa.String(length=100), nullable=True)
    )


def downgrade():
    op.drop_table("stripe_event")
    op.drop_column("user", "microsoft_id")
    op.drop_column("vendor_app", "rejection_reason")
