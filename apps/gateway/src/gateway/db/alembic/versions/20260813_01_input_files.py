"""Add Input File metadata.

Revision ID: 20260813_01
Revises: 20260812_01
"""

from typing import Final

import sqlalchemy as sa
from alembic import op

revision: Final = "20260813_01"
down_revision = "20260812_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "input_files",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_user_id", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_input_files")),
        schema="gateway",
    )
    op.create_index(
        op.f("ix_input_files_owner_user_id"),
        "input_files",
        ["owner_user_id"],
        unique=False,
        schema="gateway",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_input_files_owner_user_id"),
        table_name="input_files",
        schema="gateway",
    )
    op.drop_table("input_files", schema="gateway")
