"""Create country-scoped scenarios.

Revision ID: 0001_scenarios
"""

import sqlalchemy as sa

from alembic import op

revision = "0001_scenarios"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scenarios",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("country_code", "idempotency_key"),
    )
    op.create_index("ix_scenarios_country_code", "scenarios", ["country_code"])


def downgrade() -> None:
    op.drop_index("ix_scenarios_country_code", table_name="scenarios")
    op.drop_table("scenarios")
