"""add thumbnail_url_dark and thumbnail_url_light to vendor_app (Text)

Revision ID: b7c2a3e5d9f1
Revises: a3f1e2d4b5c6
Create Date: 2026-04-14 10:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "b7c2a3e5d9f1"
down_revision = "a3f1e2d4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    # Existing thumbnail_url widened to Text — values can be URLs or base64 strings,
    # which blow past String(512) instantly.
    op.alter_column(
        "vendor_app",
        "thumbnail_url",
        existing_type=sa.String(length=512),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.add_column(
        "vendor_app",
        sa.Column("thumbnail_url_dark", sa.Text(), nullable=True),
    )
    op.add_column(
        "vendor_app",
        sa.Column("thumbnail_url_light", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("vendor_app", "thumbnail_url_light")
    op.drop_column("vendor_app", "thumbnail_url_dark")
    op.alter_column(
        "vendor_app",
        "thumbnail_url",
        existing_type=sa.Text(),
        type_=sa.String(length=512),
        existing_nullable=True,
    )
