"""`InputFileRepository` against real Postgres.

This is the one place SQL/ownership-scoping/soft-delete semantics get verified —
`InputFileService`'s own tests (tests/unit/services/test_input_files.py) fake this
layer out entirely, on purpose (see docs/agents/testing.md's seam table).
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from gateway.repositories.input_files import InputFileRepository

if TYPE_CHECKING:
    from gateway.db.database import Database


async def test_create_assigns_a_fresh_id_per_call(database: Database) -> None:
    repository = InputFileRepository(database)

    first = await repository.create(uuid4(), "user-a", "binder.pdb", 1024)
    second = await repository.create(uuid4(), "user-a", "binder.pdb", 1024)

    assert first.id != second.id


async def test_find_active_owned_returns_the_record_to_its_owner(database: Database) -> None:
    repository = InputFileRepository(database)
    created = await repository.create(uuid4(), "user-a", "binder.pdb", 1024)
    input_file_id = created.id

    found = await repository.find_active_owned("user-a", input_file_id)

    assert found is not None
    assert found.id == input_file_id
    assert found.size_bytes == 1024


async def test_find_active_owned_hides_the_record_from_other_users(database: Database) -> None:
    repository = InputFileRepository(database)
    created = await repository.create(uuid4(), "user-a", "binder.pdb", 1024)
    input_file_id = created.id

    assert await repository.find_active_owned("user-b", input_file_id) is None


async def test_find_active_owned_returns_none_for_an_unknown_id(database: Database) -> None:
    repository = InputFileRepository(database)

    assert await repository.find_active_owned("user-a", uuid4()) is None


async def test_mark_deleted_hides_the_record_from_subsequent_lookups(database: Database) -> None:
    repository = InputFileRepository(database)
    created = await repository.create(uuid4(), "user-a", "binder.pdb", 1024)
    input_file_id = created.id

    deleted = await repository.mark_deleted("user-a", input_file_id)
    assert deleted is not None
    assert deleted.id == input_file_id

    assert await repository.find_active_owned("user-a", input_file_id) is None


async def test_mark_deleted_is_a_no_op_for_a_file_the_caller_does_not_own(
    database: Database,
) -> None:
    repository = InputFileRepository(database)
    created = await repository.create(uuid4(), "user-a", "binder.pdb", 1024)
    input_file_id = created.id

    deleted = await repository.mark_deleted("user-b", input_file_id)
    assert deleted is None

    assert await repository.find_active_owned("user-a", input_file_id) is not None


async def test_mark_deleted_twice_is_a_no_op_the_second_time(database: Database) -> None:
    repository = InputFileRepository(database)
    created = await repository.create(uuid4(), "user-a", "binder.pdb", 1024)
    input_file_id = created.id

    await repository.mark_deleted("user-a", input_file_id)
    second_delete = await repository.mark_deleted("user-a", input_file_id)
    assert second_delete is None
