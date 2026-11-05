"""Store synthetic funding snapshots and dated diagnostics.

Revision ID: 0007_funding_flows
"""

import sqlalchemy as sa

from alembic import op

revision = "0007_funding_flows"
down_revision = "0006_immutable_scenarios"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "funding_flows",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("country_code", "idempotency_key"),
        sa.UniqueConstraint("id", "country_code", name="uq_funding_id_country"),
    )
    op.create_index("ix_funding_flows_country_code", "funding_flows", ["country_code"])
    op.create_table(
        "funding_diagnostics",
        sa.Column("country_code", sa.String(2), primary_key=True),
        sa.Column("flow_id", sa.Uuid(), primary_key=True),
        sa.Column("as_of", sa.Date(), primary_key=True),
        sa.Column("findings", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(
            ["flow_id", "country_code"], ["funding_flows.id", "funding_flows.country_code"]
        ),
    )
    for table in ("funding_flows", "funding_diagnostics"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_select ON {table} FOR SELECT "
            "USING (country_code = current_setting('app.country_code', true))"
        )
        op.execute(
            f"CREATE POLICY {table}_insert ON {table} FOR INSERT "
            "WITH CHECK (country_code = current_setting('app.country_code', true))"
        )


def downgrade() -> None:
    for table in ("funding_diagnostics", "funding_flows"):
        op.execute(f"DROP POLICY {table}_select ON {table}")
        op.execute(f"DROP POLICY {table}_insert ON {table}")
    op.drop_table("funding_diagnostics")
    op.drop_index("ix_funding_flows_country_code", table_name="funding_flows")
    op.drop_table("funding_flows")
