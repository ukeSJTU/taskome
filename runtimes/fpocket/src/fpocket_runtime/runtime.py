from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

_REQUIRED_OUTPUT_SUFFIXES = ("_info.txt", "_out.pdb", "_pockets.pqr")


class FpocketOutputError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class FpocketRun:
    output_directory: Path
    stdout: str
    stderr: str


def run_fpocket(input_path: Path) -> FpocketRun:
    executable = shutil.which("fpocket")
    if executable is None:
        message = "fpocket executable was not found on PATH"
        raise FileNotFoundError(message)

    completed = subprocess.run(  # noqa: S603
        [executable, "-f", input_path.name],
        cwd=input_path.parent,
        check=False,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
    )
    completed.check_returncode()

    output_directory = input_path.parent / f"{input_path.stem}_out"
    required_outputs = [
        output_directory / f"{input_path.stem}{suffix}" for suffix in _REQUIRED_OUTPUT_SUFFIXES
    ]
    invalid_outputs = [
        path for path in required_outputs if not path.is_file() or path.stat().st_size == 0
    ]
    if invalid_outputs:
        names = ", ".join(path.name for path in invalid_outputs)
        message = f"fpocket did not produce valid required output: {names}"
        raise FpocketOutputError(message)

    return FpocketRun(
        output_directory=output_directory,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )
