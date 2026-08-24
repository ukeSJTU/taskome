from __future__ import annotations

import json
import shutil
import subprocess
import textwrap
from pathlib import Path

import pytest

_RUNTIME_ROOT = Path(__file__).parents[2]
_REPOSITORY_ROOT = Path(__file__).parents[4]
_IMAGE = "taskome/fpocket-runtime:test"
_CONTAINER_CHECK = textwrap.dedent(
    """
    import errno
    import json
    import os
    import shutil
    from pathlib import Path

    from fpocket_runtime import run_fpocket

    source = Path("/input/input.pdb")
    input_path = Path("/work/input.pdb")
    shutil.copyfile(source, input_path)
    result = run_fpocket(input_path)

    required = sorted(
        path.name
        for path in result.output_directory.iterdir()
        if path.name in {"input_info.txt", "input_out.pdb", "input_pockets.pqr"}
        and path.is_file()
        and path.stat().st_size > 0
    )

    immutable = False
    try:
        Path("/opt/taskome/adapter/probe").touch()
    except OSError as error:
        immutable = error.errno in {errno.EACCES, errno.EROFS}

    print(json.dumps({
        "uid": os.getuid(),
        "fpocket": shutil.which("fpocket"),
        "uv": shutil.which("uv"),
        "pixi": shutil.which("pixi"),
        "pip": shutil.which("pip"),
        "adapter_immutable": immutable,
        "compute_is_directory": Path("/opt/taskome/compute").is_dir(),
        "compute_is_symlink": Path("/opt/taskome/compute").is_symlink(),
        "pixi_workspace_exists": Path("/opt/taskome/compute-workspace").exists(),
        "required_outputs": required,
        "stdout_begins": result.stdout.splitlines()[0].strip(),
        "stdout_ends": result.stdout.splitlines()[-1].strip(),
        "stderr": result.stderr,
    }))
    """
)


@pytest.fixture(scope="session")
def fpocket_image() -> str:
    docker = shutil.which("docker")
    assert docker is not None, "Docker is required for fpocket image tests"

    completed = subprocess.run(  # noqa: S603
        [
            docker,
            "build",
            "--platform",
            "linux/amd64",
            "--file",
            "runtimes/fpocket/Dockerfile",
            "--tag",
            _IMAGE,
            ".",
        ],
        cwd=_REPOSITORY_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    return _IMAGE


def test_image_fails_closed_without_attempt_entrypoint(fpocket_image: str) -> None:
    docker = shutil.which("docker")
    assert docker is not None

    completed = subprocess.run(  # noqa: S603
        [
            docker,
            "run",
            "--rm",
            "--platform",
            "linux/amd64",
            "--network",
            "none",
            fpocket_image,
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )

    assert completed.returncode != 0
    assert completed.stdout == ""
    assert completed.stderr == ""


def test_image_runs_real_fpocket_as_non_root(fpocket_image: str) -> None:
    docker = shutil.which("docker")
    assert docker is not None
    fixture = _RUNTIME_ROOT / "tests/fixtures/1UYD.pdb"

    completed = subprocess.run(  # noqa: S603
        [
            docker,
            "run",
            "--rm",
            "--platform",
            "linux/amd64",
            "--network",
            "none",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--pids-limit",
            "256",
            "--tmpfs",
            "/work:rw,exec,nosuid,nodev,size=64m,mode=1777",
            "--tmpfs",
            "/tmp:rw,exec,nosuid,nodev,size=64m,mode=1777",  # noqa: S108
            "--mount",
            f"type=bind,source={fixture},target=/input/input.pdb,readonly",
            "--entrypoint",
            "/opt/taskome/adapter/bin/python",
            fpocket_image,
            "-c",
            _CONTAINER_CHECK,
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )

    assert completed.returncode == 0, completed.stderr
    assert json.loads(completed.stdout) == {
        "adapter_immutable": True,
        "compute_is_directory": True,
        "compute_is_symlink": False,
        "fpocket": "/opt/taskome/compute/bin/fpocket",
        "pip": None,
        "pixi": None,
        "pixi_workspace_exists": False,
        "required_outputs": ["input_info.txt", "input_out.pdb", "input_pockets.pqr"],
        "stderr": "",
        "stdout_begins": "***** POCKET HUNTING BEGINS *****",
        "stdout_ends": "***** POCKET HUNTING ENDS *****",
        "uid": 10001,
        "uv": None,
    }
