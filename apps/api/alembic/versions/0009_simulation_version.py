"""Pin the simulator version when a run is queued.

Revision ID: 0009_simulation_version
"""

import sqlalchemy as sa

from alembic import op

revision = "0009_simulation_version"
down_revision = "0008_request_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scenario_runs",
        sa.Column("simulation_version", sa.Integer(), nullable=False, server_default="1"),
    )
    # Stored version-2 results identify themselves; older unmarked runs retain version 1.
    # The migration owner must bypass the table's forced RLS during the backfill.
    op.execute("ALTER TABLE scenario_runs NO FORCE ROW LEVEL SECURITY")
    op.execute(
        "UPDATE scenario_runs SET simulation_version = 2 WHERE result->>'simulation_version' = '2'"
    )
    op.execute("ALTER TABLE scenario_runs FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_column("scenario_runs", "simulation_version")
