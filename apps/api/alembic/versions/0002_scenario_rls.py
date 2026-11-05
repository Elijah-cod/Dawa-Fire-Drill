"""Require a transaction-local country context for scenario access.

Revision ID: 0002_scenario_rls
"""

from alembic import op

revision = "0002_scenario_rls"
down_revision = "0001_scenarios"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE scenarios FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY scenario_country ON scenarios "
        "USING (country_code = current_setting('app.country_code', true)) "
        "WITH CHECK (country_code = current_setting('app.country_code', true))"
    )


def downgrade() -> None:
    op.execute("DROP POLICY scenario_country ON scenarios")
    op.execute("ALTER TABLE scenarios NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE scenarios DISABLE ROW LEVEL SECURITY")
