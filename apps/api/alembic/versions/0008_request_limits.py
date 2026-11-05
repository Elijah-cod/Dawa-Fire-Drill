"""Add country-scoped authenticated request limits.

Revision ID: 0008_request_limits
"""

import sqlalchemy as sa

from alembic import op

revision = "0008_request_limits"
down_revision = "0007_funding_flows"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "request_limits",
        sa.Column("country_code", sa.String(2), primary_key=True),
        sa.Column("subject_hash", sa.String(64), primary_key=True),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("calls", sa.Integer(), nullable=False),
    )
    op.execute("ALTER TABLE request_limits ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE request_limits FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY request_limits_country ON request_limits "
        "USING (country_code = current_setting('app.country_code', true)) "
        "WITH CHECK (country_code = current_setting('app.country_code', true))"
    )


def downgrade() -> None:
    op.execute("DROP POLICY request_limits_country ON request_limits")
    op.drop_table("request_limits")
