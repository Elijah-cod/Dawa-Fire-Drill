"""Persist extraction budget, cached drafts, and human-confirmed synthetic stock.

Revision ID: 0004_capture
"""

import sqlalchemy as sa

from alembic import op

revision = "0004_capture"
down_revision = "0003_scenario_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "provider_daily_usage",
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("calls", sa.Integer(), nullable=False),
    )
    op.create_table(
        "extraction_cache",
        sa.Column("country_code", sa.String(2), primary_key=True),
        sa.Column("image_hash", sa.String(64), primary_key=True),
        sa.Column("schema_version", sa.Integer(), primary_key=True),
        sa.Column("fields_json", sa.Text(), nullable=False),
    )
    op.create_table(
        "capture_drafts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("facility_id", sa.String(64), nullable=False),
        sa.Column("created_by", sa.String(200), nullable=False),
        sa.Column("image_hash", sa.String(64), nullable=False),
        sa.Column("fields", sa.JSON(), nullable=False),
        sa.Column("provider_status", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("country_code", "idempotency_key"),
        sa.UniqueConstraint("id", "country_code", name="uq_capture_id_country"),
        sa.CheckConstraint("status IN ('pending','confirmed')", name="ck_capture_status"),
    )
    op.create_index("ix_capture_drafts_country_code", "capture_drafts", ["country_code"])
    op.create_table(
        "stock_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("capture_id", sa.Uuid(), nullable=False),
        sa.Column("facility_id", sa.String(64), nullable=False),
        sa.Column("commodity_name", sa.String(200), nullable=False),
        sa.Column("opening_balance", sa.BigInteger(), nullable=False),
        sa.Column("closing_balance", sa.BigInteger(), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("confirmed_by", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("capture_id"),
        sa.ForeignKeyConstraint(
            ["capture_id", "country_code"], ["capture_drafts.id", "capture_drafts.country_code"]
        ),
    )
    op.create_index("ix_stock_entries_country_code", "stock_entries", ["country_code"])
    for table in ("extraction_cache", "capture_drafts", "stock_entries"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_country ON {table} "
            "USING (country_code = current_setting('app.country_code', true)) "
            "WITH CHECK (country_code = current_setting('app.country_code', true))"
        )


def downgrade() -> None:
    for table in ("stock_entries", "capture_drafts", "extraction_cache"):
        op.execute(f"DROP POLICY {table}_country ON {table}")
    op.drop_index("ix_stock_entries_country_code", table_name="stock_entries")
    op.drop_table("stock_entries")
    op.drop_index("ix_capture_drafts_country_code", table_name="capture_drafts")
    op.drop_table("capture_drafts")
    op.drop_table("extraction_cache")
    op.drop_table("provider_daily_usage")
