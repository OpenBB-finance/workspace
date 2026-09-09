"""legacy head marker — bridges pre-baseline DBs into the squashed chain

Clients on the prior release end at revision 7f2e1b4314ef (now in
versions_archive/). This stub gives alembic a known revision to resolve so
those DBs can `upgrade head` straight into 0001 + 0002 without a manual stamp.
0001 and 0002 guard themselves against being applied to an already-populated
DB, so the upgrade is a no-op chain for existing clients.

Revision ID: 7f2e1b4314ef
Revises:
Create Date: 2026-05-18

"""

revision = "7f2e1b4314ef"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
