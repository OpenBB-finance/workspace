"""vendor app auth fields

Revision ID: 4b1f9c8a2d35
Revises: d7032d8f9c87
Create Date: 2026-04-29 12:00:00.000000

"""

import sqlalchemy as sa

from alembic import op
from api.models import model_helpers  # type: ignore

# revision identifiers, used by Alembic.
revision = "4b1f9c8a2d35"
down_revision = "d7032d8f9c87"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "vendor_app",
        sa.Column("auth_fields", model_helpers.JSONType(), nullable=True),
    )


def downgrade():
    op.drop_column("vendor_app", "auth_fields")
