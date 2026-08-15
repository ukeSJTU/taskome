"""Postgres persistence for Job records."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID  # noqa: TC003 - SQLAlchemy expressions use UUID at runtime.

from sqlalchemy import select

from gateway.models import Job, JobStatus

if TYPE_CHECKING:
    from gateway.db.database import Database


@dataclass(frozen=True, slots=True)
class JobRecord:
    """Committed Job record returned to the service layer."""

    id: UUID
    owner_user_id: str
    task_server_name: str
    task_name: str
    params: dict[str, Any]
    params_schema_version: int
    status: JobStatus
    result: dict[str, Any] | None
    error_detail: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


def _record(job: Job) -> JobRecord:
    return JobRecord(
        id=job.id,
        owner_user_id=job.owner_user_id,
        task_server_name=job.task_server_name,
        task_name=job.task_name,
        params=job.params,
        params_schema_version=job.params_schema_version,
        status=job.status,
        result=job.result,
        error_detail=job.error_detail,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


class JobRepository:
    """Persist Jobs and their state transitions in short, self-contained transactions."""

    def __init__(self, database: Database) -> None:
        self._database = database

    async def create(  # noqa: PLR0913
        self,
        *,
        job_id: UUID,
        owner_user_id: str,
        task_server_name: str,
        task_name: str,
        params: dict[str, Any],
        params_schema_version: int,
    ) -> JobRecord:
        """Commit a new Job, durably queued before dispatch is attempted."""

        async with self._database.transaction() as session:
            job = Job(
                id=job_id,
                owner_user_id=owner_user_id,
                task_server_name=task_server_name,
                task_name=task_name,
                params=params,
                params_schema_version=params_schema_version,
                status=JobStatus.QUEUED,
            )
            session.add(job)
            await session.flush()
            return _record(job)

    async def find_owned(self, owner_user_id: str, job_id: UUID) -> JobRecord | None:
        """Find a Job owned by a user."""

        async with self._database.transaction() as session:
            job = (
                await session.execute(
                    select(Job).where(Job.id == job_id, Job.owner_user_id == owner_user_id)
                )
            ).scalar_one_or_none()
            return None if job is None else _record(job)

    async def find_by_id(self, job_id: UUID) -> JobRecord | None:
        """Find a Job by id alone, for the Task Server callback boundary.

        Not owner-scoped: only reachable internally, over the HMAC-signed
        Task-Server-to-Gateway boundary (ADR-0007), never as a REST/MCP seam.
        """

        async with self._database.transaction() as session:
            job = (await session.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            return None if job is None else _record(job)

    async def list_owned(
        self,
        owner_user_id: str,
        *,
        status: JobStatus | None,
        task_name: str | None,
        limit: int,
        offset: int,
    ) -> tuple[JobRecord, ...]:
        """List a user's own Jobs, newest first, optionally filtered."""

        query = select(Job).where(Job.owner_user_id == owner_user_id)
        if status is not None:
            query = query.where(Job.status == status)
        if task_name is not None:
            query = query.where(Job.task_name == task_name)
        query = query.order_by(Job.created_at.desc()).limit(limit).offset(offset)
        async with self._database.transaction() as session:
            jobs = (await session.execute(query)).scalars().all()
            return tuple(_record(job) for job in jobs)

    async def mark_running(self, job_id: UUID) -> JobRecord | None:
        """Transition a Job to `running` immediately before dispatch."""

        return await self._transition(job_id, status=JobStatus.RUNNING)

    async def mark_completed(self, job_id: UUID, *, result: dict[str, Any]) -> JobRecord | None:
        """Transition a Job to `completed` and persist its result."""

        return await self._transition(job_id, status=JobStatus.COMPLETED, result=result)

    async def mark_failed(self, job_id: UUID, *, error_detail: dict[str, Any]) -> JobRecord | None:
        """Transition a Job to `failed` and persist its error detail."""

        return await self._transition(job_id, status=JobStatus.FAILED, error_detail=error_detail)

    async def _transition(
        self,
        job_id: UUID,
        *,
        status: JobStatus,
        result: dict[str, Any] | None = None,
        error_detail: dict[str, Any] | None = None,
    ) -> JobRecord | None:
        async with self._database.transaction() as session:
            job = (
                await session.execute(select(Job).where(Job.id == job_id).with_for_update())
            ).scalar_one_or_none()
            if job is None:
                return None
            job.status = status
            if result is not None:
                job.result = result
            if error_detail is not None:
                job.error_detail = error_detail
            job.updated_at = datetime.now(UTC)
            await session.flush()
            return _record(job)
