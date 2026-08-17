"""Framework-independent author-facing Task types."""
# ruff: noqa: EM102, TC002, TC003, TRY003, UP035, UP046

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Generic, Mapping, Protocol, TypeVar
from uuid import UUID

import structlog
from pydantic import BaseModel, ConfigDict, RootModel

INPUT_FILE_ID_JSON_SCHEMA_MARKER = "x-taskome-input-file-id"


class InputFileId(RootModel[UUID]):
    """Opaque Gateway-owned Input File identifier, represented as a UUID in JSON."""

    model_config = ConfigDict(
        frozen=True,
        json_schema_extra={INPUT_FILE_ID_JSON_SCHEMA_MARKER: True},
    )


ParamsT = TypeVar("ParamsT", bound=BaseModel)
ResultT = TypeVar("ResultT", bound=BaseModel)
_CPU_REQUIREMENT_ERROR = "Task CPU requirement must be positive"
_GPU_REQUIREMENT_ERROR = "Task GPU requirement cannot be negative"
_EXECUTION_CEILING_ERROR = "Task execution ceiling must be positive"


class ComputeError(Exception):
    """Base class for expected adapter failures."""


class ComputeInputError(ComputeError):
    """A safe, semantic rejection after Params validation."""


class ComputeExecutionError(ComputeError):
    """An adapter or its compute environment failed."""


@dataclass(frozen=True, slots=True)
class ProducedFile:
    name: str
    relative_path: Path
    media_type: str
    download_name: str | None = None


@dataclass(frozen=True, slots=True)
class ComputeResult(Generic[ResultT]):
    value: ResultT
    outputs: tuple[ProducedFile, ...] = ()


@dataclass(frozen=True, slots=True)
class ComputeContext:
    workdir: Path
    logger: structlog.stdlib.BoundLogger
    _input_paths: Mapping[InputFileId, Path]

    def input_path(self, input_file_id: InputFileId) -> Path:
        try:
            return self._input_paths[input_file_id]
        except KeyError as error:
            raise ComputeInputError(f"Input File {input_file_id} was not materialized.") from error


class ComputeAdapter(Protocol[ParamsT, ResultT]):
    def run(self, params: ParamsT, ctx: ComputeContext) -> ComputeResult[ResultT]: ...


@dataclass(frozen=True, slots=True)
class TaskResources:
    """CPU and GPU capacity a Task needs for one invocation."""

    num_cpus: float = 1
    num_gpus: float = 0

    def __post_init__(self) -> None:
        if self.num_cpus <= 0:
            raise ValueError(_CPU_REQUIREMENT_ERROR)
        if self.num_gpus < 0:
            raise ValueError(_GPU_REQUIREMENT_ERROR)


@dataclass(frozen=True, slots=True)
class TaskDefinition(Generic[ParamsT, ResultT]):
    name: str
    description: str
    params_model: type[ParamsT]
    result_model: type[ResultT]
    adapter: ComputeAdapter[ParamsT, ResultT]
    resources: TaskResources = field(default_factory=TaskResources)
    max_duration_seconds: int = 3600

    def __post_init__(self) -> None:
        if self.max_duration_seconds <= 0:
            raise ValueError(_EXECUTION_CEILING_ERROR)
