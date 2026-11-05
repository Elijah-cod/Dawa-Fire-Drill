"""Persist immutable synthetic dataset snapshots.

Revision ID: 0005_synthetic_datasets
"""

import sqlalchemy as sa

from alembic import op

revision = "0005_synthetic_datasets"
down_revision = "0004_capture"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "synthetic_datasets",
        sa.Column("country_code", sa.String(2), primary_key=True),
        sa.Column("seed", sa.BigInteger(), primary_key=True),
        sa.Column("generator_version", sa.Integer(), primary_key=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.execute("ALTER TABLE synthetic_datasets ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE synthetic_datasets FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY dataset_select ON synthetic_datasets FOR SELECT "
        "USING (country_code = current_setting('app.country_code', true))"
    )
    op.execute(
        "CREATE POLICY dataset_insert ON synthetic_datasets FOR INSERT "
        "WITH CHECK (country_code = current_setting('app.country_code', true))"
    )
    op.add_column(
        "scenario_runs",
        sa.Column("generator_version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("scenario_runs", "generator_version")
    op.execute("DROP POLICY dataset_select ON synthetic_datasets")
    op.execute("DROP POLICY dataset_insert ON synthetic_datasets")
    op.drop_table("synthetic_datasets")
