"""Record each Input File's declared size, for Job dispatch to hand to a Task Server.

Revision ID: 20260815_03
Revises: 20260815_02
"""

from typing import Final

import sqlalchemy as sa
from alembic import op

revision: Final = "20260815_03"
down_revision = "20260815_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "input_files",
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        schema="gateway",
    )


def downgrade() -> None:
    op.drop_column("input_files", "size_bytes", schema="gateway")
