"""Persist county-scoped, lease-fenced synthetic pilot runs.

Revision ID: 0011_county_runs
"""

import sqlalchemy as sa

from alembic import op

revision = "0011_county_runs"
down_revision = "0010_county_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "county_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("county_code", sa.String(16), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("seed", sa.BigInteger(), nullable=False),
        sa.Column("snapshot_version", sa.Integer(), nullable=False),
        sa.Column("snapshot_kind", sa.String(16), nullable=False),
        sa.Column("simulation_version", sa.Integer(), nullable=False),
        sa.Column("scenario", sa.JSON(), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("lease_token", sa.Uuid(), nullable=True),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("country_code", "county_code", "idempotency_key"),
        sa.ForeignKeyConstraint(
            ["country_code", "county_code", "seed", "snapshot_version", "snapshot_kind"],
            [
                "county_snapshots.country_code",
                "county_snapshots.county_code",
                "county_snapshots.seed",
                "county_snapshots.version",
                "county_snapshots.kind",
            ],
        ),
        sa.CheckConstraint(
            "country_code = 'KE' AND county_code = '042' AND snapshot_kind = 'pilot'",
            name="ck_county_run_pilot",
        ),
        sa.CheckConstraint(
            "status IN ('queued','running','succeeded','failed')", name="ck_county_run_status"
        ),
    )
    op.execute("ALTER TABLE county_runs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE county_runs FORCE ROW LEVEL SECURITY")
    scope = (
        "country_code = current_setting('app.country_code', true) AND "
        "county_code = current_setting('app.county_code', true)"
    )
    op.execute(f"CREATE POLICY county_run_select ON county_runs FOR SELECT USING ({scope})")
    op.execute(f"CREATE POLICY county_run_insert ON county_runs FOR INSERT WITH CHECK ({scope})")
    op.execute(
        f"CREATE POLICY county_run_update ON county_runs "
        f"FOR UPDATE USING ({scope}) WITH CHECK ({scope})"
    )


def downgrade() -> None:
    for name in ("county_run_select", "county_run_insert", "county_run_update"):
        op.execute(f"DROP POLICY {name} ON county_runs")
    op.drop_table("county_runs")
