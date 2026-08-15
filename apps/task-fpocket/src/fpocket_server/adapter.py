"""ComputeAdapter wrapping the vendored fpocket binary for pocket detection."""
# ruff: noqa: EM101, TRY003

from __future__ import annotations

import os
import re
import subprocess

from task_kit import (
    ComputeAdapter,
    ComputeContext,
    ComputeExecutionError,
    ComputeInputError,
    ComputeResult,
    ProducedFile,
)

from fpocket_server.models import DetectPocketsParams, DetectPocketsValue, Pocket

_TIMEOUT_SECONDS = 120
_DIAGNOSTIC_CHARS = 4000
_STRUCTURE_INPUT_ERROR_EXIT_CODE = 1
_POCKET_HEADER = re.compile(r"^Pocket (\d+)\s*:\s*$")

_FIELD_NAMES = {
    "score": "Score",
    "druggability_score": "Druggability Score",
    "num_alpha_spheres": "Number of Alpha Spheres",
    "volume": "Volume",
}


def _parse_pockets(info_text: str) -> tuple[Pocket, ...]:
    """Parse fpocket's ``<code>_info.txt`` into structured per-pocket descriptors."""
    pockets: list[Pocket] = []
    rank: int | None = None
    fields: dict[str, str] = {}

    def flush() -> None:
        if rank is None:
            return
        pockets.append(
            Pocket(
                rank=rank,
                score=float(fields[_FIELD_NAMES["score"]]),
                druggability_score=float(fields[_FIELD_NAMES["druggability_score"]]),
                volume=float(fields[_FIELD_NAMES["volume"]]),
                num_alpha_spheres=int(fields[_FIELD_NAMES["num_alpha_spheres"]]),
            )
        )

    for line in info_text.splitlines():
        header = _POCKET_HEADER.match(line)
        if header:
            flush()
            rank = int(header.group(1))
            fields = {}
            continue
        if ":" not in line:
            continue
        label, _, value = line.partition(":")
        fields[label.strip()] = value.strip()
    flush()
    return tuple(pockets)


class DetectPocketsAdapter(ComputeAdapter[DetectPocketsParams, DetectPocketsValue]):
    def run(
        self,
        params: DetectPocketsParams,
        ctx: ComputeContext,
    ) -> ComputeResult[DetectPocketsValue]:
        source = ctx.input_path(params.structure)
        structure_path = ctx.workdir / "structure.pdb"
        structure_path.write_bytes(source.read_bytes())

        binary = os.environ.get("FPOCKET_BINARY", "fpocket")
        argv = [
            binary,
            "-f",
            structure_path.name,
            "-m",
            str(params.min_alpha_size),
            "-M",
            str(params.max_alpha_size),
            "-i",
            str(params.min_spheres_per_pocket),
        ]
        try:
            completed = subprocess.run(  # noqa: S603
                argv,
                cwd=ctx.workdir,
                capture_output=True,
                text=True,
                timeout=_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise ComputeExecutionError("fpocket timed out") from error
        except OSError as error:
            raise ComputeExecutionError("fpocket could not be started") from error

        if completed.returncode == _STRUCTURE_INPUT_ERROR_EXIT_CODE:
            raise ComputeInputError(
                "fpocket could not read the provided structure. "
                "Confirm it is a valid, non-empty PDB file."
            )
        if completed.returncode != 0:
            ctx.logger.error(
                "fpocket_unexpected_exit",
                returncode=completed.returncode,
                stderr=completed.stderr[:_DIAGNOSTIC_CHARS],
            )
            raise ComputeExecutionError("fpocket exited with an unexpected status")

        output_dir = ctx.workdir / "structure_out"
        if not output_dir.is_dir():
            return ComputeResult(value=DetectPocketsValue(pocket_count=0, pockets=()))

        info_path = output_dir / "structure_info.txt"
        pockets = _parse_pockets(info_path.read_text()) if info_path.is_file() else ()

        outputs: tuple[ProducedFile, ...] = ()
        annotated = output_dir / "structure_out.pdb"
        if annotated.is_file():
            outputs = (
                ProducedFile(
                    name="annotated_structure",
                    relative_path=annotated.relative_to(ctx.workdir),
                    media_type="chemical/x-pdb",
                    download_name="structure_out.pdb",
                ),
            )

        return ComputeResult(
            value=DetectPocketsValue(pocket_count=len(pockets), pockets=pockets),
            outputs=outputs,
        )
