"""rename group tables to role

Revision ID: e337419ca6a7
Revises: 75ad2dd38c07
Create Date: 2025-02-05 13:40:50.515180

"""

import sqlalchemy as sa
import sqlalchemy_utils

import api
from alembic import op  # type: ignore

# revision identifiers, used by Alembic.
revision = "e337419ca6a7"
down_revision = "75ad2dd38c07"
branch_labels = None
depends_on = None


def upgrade():
    dialect = op.get_bind().dialect.name
    # First drop foreign keys
    op.drop_constraint("fk_user_group_group_uuid_group", "user_group", type_="foreignkey")
    op.drop_constraint("fk_user_group_user_uuid_user", "user_group", type_="foreignkey")
    op.drop_constraint("fk_group_entity_uuid_entity", "group", type_="foreignkey")

    # Then drop indexes and tables
    op.drop_table("user_group")
    if dialect == "mysql":
        op.drop_index("ix_group_entity_uuid", table_name="group")
        op.drop_index("uix_group_entity_name", table_name="group")
    elif dialect == "postgresql":
        op.drop_index("ix_group_entity_uuid", table_name="group")
        op.drop_constraint("uix_group_entity_name", "group", type_="unique")

    op.drop_table("group")

    # Create new tables
    op.create_table(
        "role",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("entity_uuid", sqlalchemy_utils.types.uuid.UUIDType(), nullable=False),
        sa.Column("uuid", sqlalchemy_utils.types.uuid.UUIDType(), nullable=False),
        sa.Column("created_date", api.models.model_helpers.AwareDateTime(), nullable=True),
        sa.Column("updated_date", api.models.model_helpers.AwareDateTime(), nullable=True),
        sa.ForeignKeyConstraint(["entity_uuid"], ["entity.uuid"], name=op.f("fk_role_entity_uuid_entity")),
        sa.PrimaryKeyConstraint("uuid"),
        sa.UniqueConstraint("entity_uuid", "name", name="uix_role_entity_name"),
    )
    op.create_index(op.f("ix_role_entity_uuid"), "role", ["entity_uuid"], unique=False)
    op.create_table(
        "user_role",
        sa.Column("user_uuid", sqlalchemy_utils.types.uuid.UUIDType(), nullable=False),
        sa.Column("role_uuid", sqlalchemy_utils.types.uuid.UUIDType(), nullable=False),
        sa.Column("uuid", sqlalchemy_utils.types.uuid.UUIDType(), nullable=False),
        sa.Column("created_date", api.models.model_helpers.AwareDateTime(), nullable=True),
        sa.Column("updated_date", api.models.model_helpers.AwareDateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["role_uuid"],
            ["role.uuid"],
            name=op.f("fk_user_role_role_uuid_role"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_uuid"], ["user.uuid"], name=op.f("fk_user_role_user_uuid_user")),
        sa.PrimaryKeyConstraint("uuid"),
    )
    op.create_index(op.f("ix_user_role_role_uuid"), "user_role", ["role_uuid"], unique=False)
    op.create_index(op.f("ix_user_role_user_uuid"), "user_role", ["user_uuid"], unique=False)


def downgrade():
    # First drop constraints in reverse order
    op.drop_constraint("fk_user_role_role_uuid_role", "user_role", type_="foreignkey")
    op.drop_constraint("fk_user_role_user_uuid_user", "user_role", type_="foreignkey")
    op.drop_constraint("fk_role_entity_uuid_entity", "role", type_="foreignkey")

    # Then drop tables and create old ones
    op.drop_table("user_role")
    op.drop_table("role")
    op.create_table(
        "user_group",
        sa.Column("user_uuid", sa.BINARY(length=16), nullable=False),
        sa.Column("group_uuid", sa.BINARY(length=16), nullable=False),
        sa.Column("uuid", sa.BINARY(length=16), nullable=False),
        sa.Column("created_date", sa.DATETIME(), nullable=True),
        sa.Column("updated_date", sa.DATETIME(), nullable=True),
        sa.ForeignKeyConstraint(
            ["group_uuid"],
            ["group.uuid"],
            name="fk_user_group_group_uuid_group",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_uuid"], ["user.uuid"], name="fk_user_group_user_uuid_user"),
        sa.PrimaryKeyConstraint("uuid"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
    )
    op.create_index("ix_user_group_user_uuid", "user_group", ["user_uuid"], unique=False)
    op.create_index("ix_user_group_group_uuid", "user_group", ["group_uuid"], unique=False)
    op.create_table(
        "group",
        sa.Column("name", sa.VARCHAR(length=100), nullable=False),
        sa.Column("description", sa.TEXT(), nullable=False),
        sa.Column("entity_uuid", sa.BINARY(length=16), nullable=False),
        sa.Column("uuid", sa.BINARY(length=16), nullable=False),
        sa.Column("created_date", sa.DATETIME(), nullable=True),
        sa.Column("updated_date", sa.DATETIME(), nullable=True),
        sa.ForeignKeyConstraint(["entity_uuid"], ["entity.uuid"], name="fk_group_entity_uuid_entity"),
        sa.PrimaryKeyConstraint("uuid"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
    )
    op.create_index("uix_group_entity_name", "group", ["entity_uuid", "name"], unique=True)
    op.create_index("ix_group_entity_uuid", "group", ["entity_uuid"], unique=False)
