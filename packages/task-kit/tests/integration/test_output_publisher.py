# ruff: noqa: EM101, N803, PLR2004, S101, TC003, TRY003

from pathlib import Path
from uuid import UUID

import pytest
import structlog
from task_kit.production import S3OutputPublisher
from task_kit.runtime import ValidatedProducedFile


class FailingS3Client:
    def __init__(self) -> None:
        self.deleted: list[str] = []
        self.writes = 0

    def put_object(self, **kwargs: object) -> None:
        self.writes += 1
        if self.writes == 2:
            raise RuntimeError("storage unavailable")
        assert kwargs["IfNoneMatch"] == "*"

    def delete_object(self, *, Bucket: str, Key: str) -> None:
        del Bucket
        self.deleted.append(Key)


@pytest.mark.asyncio
async def test_output_publication_rolls_back_already_written_objects(tmp_path: Path) -> None:
    first, second = tmp_path / "first.txt", tmp_path / "second.txt"
    first.write_text("first")
    second.write_text("second")
    files = (
        ValidatedProducedFile("first", first, "text/plain", None, 5, "a" * 64),
        ValidatedProducedFile("second", second, "text/plain", None, 6, "b" * 64),
    )
    client = FailingS3Client()
    publisher = S3OutputPublisher(client, "taskome", structlog.get_logger())

    with pytest.raises(RuntimeError, match="storage unavailable"):
        await publisher.publish("echo", UUID("00000000-0000-0000-0000-000000000006"), files)

    assert client.deleted == ["echo/00000000-0000-0000-0000-000000000006/first"]
