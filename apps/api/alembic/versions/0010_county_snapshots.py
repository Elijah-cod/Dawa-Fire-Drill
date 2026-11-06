"""Add immutable country-and-county-scoped synthetic snapshots.

Revision ID: 0010_county_snapshots
"""

import sqlalchemy as sa

from alembic import op

revision = "0010_county_snapshots"
down_revision = "0009_simulation_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "county_snapshots",
        sa.Column("country_code", sa.String(2), primary_key=True),
        sa.Column("county_code", sa.String(16), primary_key=True),
        sa.Column("seed", sa.BigInteger(), primary_key=True),
        sa.Column("version", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(16), primary_key=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('planning', 'pilot')", name="ck_county_snapshot_kind"),
        sa.CheckConstraint(
            "kind <> 'pilot' OR (country_code = 'KE' AND county_code = '042')",
            name="ck_county_snapshot_pilot_scope",
        ),
    )
    op.execute("ALTER TABLE county_snapshots ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE county_snapshots FORCE ROW LEVEL SECURITY")
    scope = (
        "country_code = current_setting('app.country_code', true) AND "
        "county_code = current_setting('app.county_code', true)"
    )
    op.execute(
        f"CREATE POLICY county_snapshot_select ON county_snapshots FOR SELECT USING ({scope})"
    )
    op.execute(
        f"CREATE POLICY county_snapshot_insert ON county_snapshots FOR INSERT WITH CHECK ({scope})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY county_snapshot_select ON county_snapshots")
    op.execute("DROP POLICY county_snapshot_insert ON county_snapshots")
    op.drop_table("county_snapshots")
