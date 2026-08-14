"""Framework-independent author-facing Task types."""
# ruff: noqa: EM102, TC002, TC003, TRY003, UP035, UP046

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Generic, Mapping, Protocol, TypeVar
from uuid import UUID

import structlog
from pydantic import BaseModel
from pydantic_core import core_schema


class InputFileId(UUID):
    """Opaque Gateway-owned Input File identifier, represented as a UUID in JSON."""

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: object, handler: object
    ) -> core_schema.CoreSchema:
        del source_type, handler
        return core_schema.no_info_after_validator_function(
            lambda value: cls(str(value)),
            core_schema.uuid_schema(),
            serialization=core_schema.to_string_ser_schema(),
        )


ParamsT = TypeVar("ParamsT", bound=BaseModel)
ResultT = TypeVar("ResultT", bound=BaseModel)


class ComputeError(Exception):
    """Base class for expected adapter failures."""


class ComputeInputError(ComputeError):
    """A safe, semantic rejection after Params validation."""


class ComputeExecutionError(ComputeError):
    """An adapter or its compute environment failed."""


@dataclass(frozen=True, slots=True)
class ProducedFile:
    name: str
    path: Path
    media_type: str
    download_name: str | None = None


@dataclass(frozen=True, slots=True)
class ComputeResult(Generic[ResultT]):
    value: ResultT
    files: tuple[ProducedFile, ...] = ()


@dataclass(frozen=True, slots=True)
class ComputeContext:
    workdir: Path
    input_paths: Mapping[InputFileId, Path]
    logger: structlog.stdlib.BoundLogger

    def input_path(self, input_file_id: InputFileId) -> Path:
        try:
            return self.input_paths[input_file_id]
        except KeyError as error:
            raise ComputeInputError(f"Input File {input_file_id} was not materialized.") from error


class ComputeAdapter(Protocol[ParamsT, ResultT]):
    def run(self, params: ParamsT, ctx: ComputeContext) -> ComputeResult[ResultT]: ...


@dataclass(frozen=True, slots=True)
class TaskDefinition(Generic[ParamsT, ResultT]):
    name: str
    description: str
    params_model: type[ParamsT]
    result_model: type[ResultT]
    adapter: ComputeAdapter[ParamsT, ResultT]
