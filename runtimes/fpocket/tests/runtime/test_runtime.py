from __future__ import annotations

import stat
import subprocess
import sys
from typing import TYPE_CHECKING

import pytest
from fpocket_runtime import FpocketOutputError, run_fpocket

if TYPE_CHECKING:
    from pathlib import Path


def test_run_fpocket_returns_validated_output_directory(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    input_path = tmp_path / "input.pdb"
    input_path.write_text("ATOM\n")
    _install_fake_fpocket(tmp_path, monkeypatch)

    result = run_fpocket(input_path)

    assert result.output_directory == tmp_path / "input_out"
    assert result.stdout == "***** POCKET HUNTING BEGINS *****\n***** POCKET HUNTING ENDS *****\n"
    assert result.stderr == ""


def test_run_fpocket_reports_upstream_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    input_path = tmp_path / "input.pdb"
    input_path.write_text("ATOM\n")
    _install_fake_fpocket(tmp_path, monkeypatch)
    monkeypatch.setenv("FAKE_FPOCKET_MODE", "fail")

    with pytest.raises(subprocess.CalledProcessError) as error:
        run_fpocket(input_path)

    assert error.value.returncode == 7
    assert error.value.stderr == "! Structure reading failed!\n"


def test_run_fpocket_rejects_missing_required_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    input_path = tmp_path / "input.pdb"
    input_path.write_text("ATOM\n")
    _install_fake_fpocket(tmp_path, monkeypatch)
    monkeypatch.setenv("FAKE_FPOCKET_MODE", "missing-output")

    with pytest.raises(FpocketOutputError, match=r"input_pockets\.pqr"):
        run_fpocket(input_path)


def test_run_fpocket_rejects_empty_required_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    input_path = tmp_path / "input.pdb"
    input_path.write_text("ATOM\n")
    _install_fake_fpocket(tmp_path, monkeypatch)
    monkeypatch.setenv("FAKE_FPOCKET_MODE", "empty-output")

    with pytest.raises(FpocketOutputError, match=r"input_pockets\.pqr"):
        run_fpocket(input_path)


def _install_fake_fpocket(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    executable = bin_directory / "fpocket"
    executable.write_text(
        f"""#!{sys.executable}
import os
from pathlib import Path
import sys

if sys.argv[1:] != ["-f", "input.pdb"]:
    raise SystemExit(64)

if os.environ.get("FAKE_FPOCKET_MODE") == "fail":
    print("! Structure reading failed!", file=sys.stderr)
    raise SystemExit(7)

output_directory = Path.cwd() / "input_out"
output_directory.mkdir()
output_names = ["input_info.txt", "input_out.pdb", "input_pockets.pqr"]
if os.environ.get("FAKE_FPOCKET_MODE") == "missing-output":
    output_names.remove("input_pockets.pqr")
for name in output_names:
    content = f"{{name}} output\\n"
    if os.environ.get("FAKE_FPOCKET_MODE") == "empty-output" and name == "input_pockets.pqr":
        content = ""
    (output_directory / name).write_text(content)

print("***** POCKET HUNTING BEGINS *****")
print("***** POCKET HUNTING ENDS *****")
"""
    )
    executable.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
    monkeypatch.setenv("PATH", str(bin_directory))
