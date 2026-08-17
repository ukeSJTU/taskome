"""Add Gateway Worker heartbeats to Job records.

Revision ID: 20260817_04
Revises: 20260815_03
"""

from typing import Final

import sqlalchemy as sa
from alembic import op

revision: Final = "20260817_04"
down_revision = "20260815_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        schema="gateway",
    )


def downgrade() -> None:
    op.drop_column("last_heartbeat_at", schema="gateway")
