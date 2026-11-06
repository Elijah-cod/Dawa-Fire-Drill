"""Store county-scoped synthetic bin-card captures separately from legacy data."""

import sqlalchemy as sa

from alembic import op

revision = "0012_county_captures"
down_revision = "0011_county_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "county_captures",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("county_code", sa.String(16), nullable=False),
        sa.Column("facility_id", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("created_by", sa.String(200), nullable=False),
        sa.Column("image_hash", sa.String(64), nullable=False),
        sa.Column("fields", sa.JSON(), nullable=False),
        sa.Column("provider_status", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("confirmed_fields", sa.JSON(), nullable=True),
        sa.Column("confirmed_by", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("country_code", "county_code", "idempotency_key"),
        sa.CheckConstraint("country_code = 'KE' AND county_code = '042'", name="ck_capture_pilot"),
        sa.CheckConstraint("status IN ('pending','confirmed')", name="ck_county_capture_status"),
    )
    op.execute("ALTER TABLE county_captures ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE county_captures FORCE ROW LEVEL SECURITY")
    scope = (
        "country_code = current_setting('app.country_code', true) AND "
        "county_code = current_setting('app.county_code', true)"
    )
    for action in ("SELECT", "INSERT", "UPDATE"):
        rule = f"WITH CHECK ({scope})" if action == "INSERT" else f"USING ({scope})"
        if action == "UPDATE":
            rule += f" WITH CHECK ({scope})"
        op.execute(
            f"CREATE POLICY county_capture_{action.lower()} ON county_captures FOR {action} {rule}"
        )


def downgrade() -> None:
    op.drop_table("county_captures")
