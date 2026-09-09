import sys
import time
import traceback
from collections.abc import Iterable
from datetime import timedelta
from logging.config import fileConfig
from uuid import uuid4

from sqlalchemy import engine_from_config, pool

# Importing the models package registers all tables on Base.metadata.
import api.models  # noqa: F401, PLC0415
from alembic import context  # type: ignore
from api.models.model_helpers import Base
from utilities.config import settings

POD_NODE = uuid4()
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

database_url = settings.get_write_url()
# database_url = "mysql+pymysql://root:root@localhost:3360/sample_db?charset=utf8"
config.set_main_option("sqlalchemy.url", database_url)


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    is_sqlite = settings.DATABASE_TYPE == "sqlite"
    use_redis_lock = not is_sqlite

    if use_redis_lock:
        redis_key = "alembic_migrations"
        settings.redis_cache(redis_key, POD_NODE.hex, expire=timedelta(minutes=2))

        showed_lock_message = False
        while (check := settings.redis_cache(redis_key)) not in {POD_NODE.hex, "done"}:
            if not showed_lock_message:
                print(  # noqa: T201
                    f"🛑 Another migration in progress by pod {check}, waiting to acquire lock..."
                )
                showed_lock_message = True
            time.sleep(5)  # wait for other migration to finish

        if check == "done":
            print("Migrations already applied, skipping...")  # noqa: T201
            return

    kwargs = {}
    if ssl_config := settings.get_ssl_config():
        kwargs["connect_args"] = {"ssl": ssl_config}

    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.StaticPool if is_sqlite else pool.NullPool,
        **kwargs,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Required for SQLite ALTER TABLE support
            process_revision_directives=get_revision_directives_func(),
            user_module_prefix="model_helpers.",
        )

        with context.begin_transaction():
            context.run_migrations()

    if use_redis_lock:
        settings.redis_cache(
            redis_key, "done", update=True, expire=timedelta(seconds=30)
        )


def get_revision_directives_func():
    from alembic.environment import MigrationContext  # noqa: PLC0415
    from alembic.operations import MigrationScript, ops  # noqa: PLC0415

    def process_revision_directives(
        context: MigrationContext,
        revision: str | Iterable[str | None] | Iterable[str],
        directives: list[MigrationScript],
    ):
        script = directives[0]
        # If the migration is being auto-generated, and there are no changes to be made,
        # clears the directives list to prevent Alembic from creating an empty migration file.
        if config.cmd_opts and getattr(config.cmd_opts, "autogenerate", False):
            if script.upgrade_ops and script.upgrade_ops.is_empty():
                directives[:] = []
            return

        # process both "def upgrade()", "def downgrade()"
        for d in (script.upgrade_ops, script.downgrade_ops):
            # make a set of tables that are being dropped within
            # the migration function
            tables_dropped = set()
            for op in d.ops:
                if isinstance(op, ops.DropTableOp):
                    tables_dropped.add((op.table_name, op.schema))

            # now rewrite the list of "ops" such that DropIndexOp
            # is removed for those tables.   Needs a recursive function.
            d.ops = list(_filter_drop_indexes(d.ops, tables_dropped))

    def _filter_drop_indexes(
        directives: list[ops.MigrateOperation], tables_dropped: set[tuple[str, str]]
    ):
        # given a set of (tablename, schemaname) to be dropped, filter
        # out DropIndexOp from the list of directives and yield the result.

        for d in directives:
            # ModifyTableOps is a container of ALTER TABLE types of
            # commands.  process those in place recursively.
            if (
                isinstance(d, ops.ModifyTableOps)
                and (d.table_name, d.schema) in tables_dropped
            ):
                d.ops = list(_filter_drop_indexes(d.ops, tables_dropped))

                # if we emptied out the directives, then skip the
                # container altogether.
                if not d.ops:
                    continue
            elif (
                isinstance(d, ops.DropIndexOp)
                and (d.table_name, d.schema) in tables_dropped
            ):
                # we found a target DropIndexOp.   keep looping
                continue

            # otherwise if not filtered, yield out the directive
            yield d

    return process_revision_directives


try:
    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()
except (KeyboardInterrupt, Exception) as exc:
    if isinstance(exc, KeyboardInterrupt):
        print("\nMigration interrupted, releasing lock...\n\n")  # noqa: T201
    else:
        traceback.print_exc()
        print("\n🚨🚨🚨 Migration failed, releasing lock...\n\n")  # noqa: T201

    # settings.redis_cache("alembic_migrations", delete=True)
    sys.exit(1)
