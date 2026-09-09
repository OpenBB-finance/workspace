"""add development status, owner_uuid, and version to vendor_app

Revision ID: a3f1e2d4b5c6
Revises: 78cfa7d6b4a6
Create Date: 2026-04-08 12:00:00.000000

"""

import sqlalchemy as sa
import sqlalchemy_utils
from sqlalchemy.dialects.postgresql import ENUM

from alembic import op

# revision identifiers, used by Alembic.
revision = "a3f1e2d4b5c6"
down_revision = "78cfa7d6b4a6"
branch_labels = None
depends_on = None


def upgrade():
    # Add 'development' to the appstatus enum (MySQL uses column-level enum)
    enums = (
        "submitted",
        "verified",
        "development",
        "published",
        "disabled",
        "removed",
    )

    op.alter_column(
        "vendor_app",
        "status",
        type_=sa.Enum(*enums, name="appstatus").with_variant(
            ENUM(*enums, name="appstatus", create_type=False),
            "postgresql",
        ),
        existing_nullable=False,
    )

    # Add owner_uuid column
    op.add_column(
        "vendor_app",
        sa.Column(
            "owner_uuid",
            sqlalchemy_utils.types.uuid.UUIDType(),
            nullable=True,
        ),
    )
    op.create_index(
        op.f("ix_vendor_app_owner_uuid"),
        "vendor_app",
        ["owner_uuid"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_vendor_app_owner_uuid_user"),
        "vendor_app",
        "user",
        ["owner_uuid"],
        ["uuid"],
        ondelete="SET NULL",
    )

    # Add version column (default "1" for existing rows)
    op.add_column(
        "vendor_app",
        sa.Column("version", sa.String(50), nullable=False, server_default="1"),
    )
    op.create_unique_constraint(
        "uq_vendor_app_name_version",
        "vendor_app",
        ["vendor_uuid", "name", "version"],
    )

    # Add owner_uuid to vendor table
    op.add_column(
        "vendor",
        sa.Column(
            "owner_uuid",
            sqlalchemy_utils.types.uuid.UUIDType(),
            nullable=True,
        ),
    )
    op.create_index(
        op.f("ix_vendor_owner_uuid"),
        "vendor",
        ["owner_uuid"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_vendor_owner_uuid_user"),
        "vendor",
        "user",
        ["owner_uuid"],
        ["uuid"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_vendor_owner_uuid_user"),
        "vendor",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_vendor_owner_uuid"), table_name="vendor")
    op.drop_column("vendor", "owner_uuid")

    op.drop_constraint("uq_vendor_app_name_version", "vendor_app", type_="unique")
    op.drop_column("vendor_app", "version")

    op.drop_constraint(
        op.f("fk_vendor_app_owner_uuid_user"),
        "vendor_app",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_vendor_app_owner_uuid"), table_name="vendor_app")
    op.drop_column("vendor_app", "owner_uuid")

    enums = (
        "submitted",
        "verified",
        "published",
        "disabled",
        "removed",
    )

    op.alter_column(
        "vendor_app",
        "status",
        type_=sa.Enum(*enums, name="appstatus").with_variant(
            ENUM(*enums, name="appstatus", create_type=False),
            "postgresql",
        ),
        existing_nullable=False,
    )
