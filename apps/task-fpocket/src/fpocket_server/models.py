"""Params/Result models for the ``detect_pockets`` Task."""
# ruff: noqa: EM101, TC002, TRY003

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator
from task_kit import InputFileId

# fpocket's own compiled-in defaults (compute/headers/fparams.h).
DEFAULT_MIN_ALPHA_SIZE = 3.4
DEFAULT_MAX_ALPHA_SIZE = 6.2
DEFAULT_MIN_SPHERES_PER_POCKET = 15


class DetectPocketsParams(BaseModel):
    structure: InputFileId
    min_alpha_size: float = Field(default=DEFAULT_MIN_ALPHA_SIZE, gt=0)
    max_alpha_size: float = Field(default=DEFAULT_MAX_ALPHA_SIZE, gt=0)
    min_spheres_per_pocket: int = Field(default=DEFAULT_MIN_SPHERES_PER_POCKET, gt=0)

    @model_validator(mode="after")
    def require_ascending_alpha_range(self) -> DetectPocketsParams:
        if self.min_alpha_size >= self.max_alpha_size:
            raise ValueError("min_alpha_size must be less than max_alpha_size")
        return self


class Pocket(BaseModel):
    rank: int
    score: float
    druggability_score: float
    volume: float
    num_alpha_spheres: int


class DetectPocketsValue(BaseModel):
    pocket_count: int
    pockets: tuple[Pocket, ...]
