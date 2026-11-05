"""Make scenario inputs immutable for the non-superuser application role.

Revision ID: 0006_immutable_scenarios
"""

from alembic import op

revision = "0006_immutable_scenarios"
down_revision = "0005_synthetic_datasets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP POLICY scenario_country ON scenarios")
    op.execute(
        "CREATE POLICY scenario_select ON scenarios FOR SELECT "
        "USING (country_code = current_setting('app.country_code', true))"
    )
    op.execute(
        "CREATE POLICY scenario_insert ON scenarios FOR INSERT "
        "WITH CHECK (country_code = current_setting('app.country_code', true))"
    )


def downgrade() -> None:
    op.execute("DROP POLICY scenario_select ON scenarios")
    op.execute("DROP POLICY scenario_insert ON scenarios")
    op.execute(
        "CREATE POLICY scenario_country ON scenarios "
        "USING (country_code = current_setting('app.country_code', true)) "
        "WITH CHECK (country_code = current_setting('app.country_code', true))"
    )
