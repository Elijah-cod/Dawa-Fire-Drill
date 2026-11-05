"""Persist country-scoped asynchronous scenario runs.

Revision ID: 0003_scenario_runs
"""

import sqlalchemy as sa

from alembic import op

revision = "0003_scenario_runs"
down_revision = "0002_scenario_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_scenarios_id_country", "scenarios", ["id", "country_code"])
    op.create_table(
        "scenario_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("seed", sa.BigInteger(), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.String(200), nullable=True),
        sa.Column("lease_token", sa.Uuid(), nullable=True),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("country_code", "idempotency_key"),
        sa.ForeignKeyConstraint(
            ["scenario_id", "country_code"], ["scenarios.id", "scenarios.country_code"]
        ),
        sa.CheckConstraint(
            "status IN ('queued','running','succeeded','failed')", name="ck_run_status"
        ),
    )
    op.create_index("ix_scenario_runs_country_code", "scenario_runs", ["country_code"])
    op.execute("ALTER TABLE scenario_runs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE scenario_runs FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY run_country ON scenario_runs "
        "USING (country_code = current_setting('app.country_code', true)) "
        "WITH CHECK (country_code = current_setting('app.country_code', true))"
    )


def downgrade() -> None:
    op.execute("DROP POLICY run_country ON scenario_runs")
    op.drop_index("ix_scenario_runs_country_code", table_name="scenario_runs")
    op.drop_table("scenario_runs")
    op.drop_constraint("uq_scenarios_id_country", "scenarios", type_="unique")
