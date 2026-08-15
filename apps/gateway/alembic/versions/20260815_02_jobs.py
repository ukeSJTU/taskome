"""Add Job records.

Revision ID: 20260815_02
Revises: 20260813_01
"""

from typing import Final

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: Final = "20260815_02"
down_revision = "20260813_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.String(length=255), nullable=False),
        sa.Column("task_server_name", sa.String(length=63), nullable=False),
        sa.Column("task_name", sa.String(length=63), nullable=False),
        sa.Column("params", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("params_schema_version", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "queued",
                "running",
                "completed",
                "failed",
                name="job_status",
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_jobs")),
        schema="gateway",
    )
    op.create_index(
        op.f("ix_jobs_owner_user_id"),
        "jobs",
        ["owner_user_id"],
        unique=False,
        schema="gateway",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_jobs_owner_user_id"),
        table_name="jobs",
        schema="gateway",
    )
    op.drop_table("jobs", schema="gateway")
