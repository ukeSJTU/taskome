"""Production OCI image contracts for Taskome's deployable web applications."""
# ruff: noqa: PLR2004, S101

from __future__ import annotations

import json
import shutil
import subprocess
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

import pytest

if TYPE_CHECKING:
    from collections.abc import Iterator
    from email.message import Message


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DOCKER = shutil.which("docker")
SERVER_ERROR_STATUS = 500


@dataclass(frozen=True)
class HttpResponse:
    body: bytes
    headers: Message
    status_code: int


def run_docker(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(  # noqa: S603
        [DOCKER or "docker", *args],
        check=check,
        cwd=REPOSITORY_ROOT,
        text=True,
        capture_output=True,
    )


@pytest.fixture(scope="session", autouse=True)
def docker_engine() -> None:
    if DOCKER is None:
        pytest.skip("Docker is required for OCI image smoke tests")
    if run_docker("info", check=False).returncode != 0:
        pytest.skip("A running Docker engine is required for OCI image smoke tests")


@contextmanager
def running_container(
    image: str,
    container_port: int,
    environment: dict[str, str] | None = None,
) -> Iterator[str]:
    container_name = f"taskome-image-test-{uuid4().hex}"
    command = [
        "run",
        "--detach",
        "--name",
        container_name,
        "--publish",
        f"127.0.0.1::{container_port}",
    ]
    for key, value in (environment or {}).items():
        command.extend(["--env", f"{key}={value}"])
    command.append(image)
    run_docker(*command)

    try:
        wait_for_healthy_container(container_name)
        port_output = run_docker("port", container_name, str(container_port)).stdout
        port = port_output.rsplit(":", 1)[1].strip()
        yield f"http://127.0.0.1:{port}"
    finally:
        run_docker("rm", "--force", container_name, check=False)


def wait_for_response(
    origin: str,
    path: str = "/",
    headers: dict[str, str] | None = None,
) -> HttpResponse:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            request = Request(f"{origin}{path}", headers=headers or {})  # noqa: S310
            with urlopen(request, timeout=2) as response:  # noqa: S310
                result = HttpResponse(
                    body=response.read(),
                    headers=response.headers,
                    status_code=response.status,
                )
        except HTTPError as error:
            result = HttpResponse(body=error.read(), headers=error.headers, status_code=error.code)
        except URLError:
            time.sleep(0.5)
            continue
        if result.status_code < SERVER_ERROR_STATUS:
            return result
        time.sleep(0.5)
    pytest.fail(f"Image did not serve {path} within 60 seconds")


def build_image(dockerfile: str, *, build_args: dict[str, str] | None = None) -> str:
    image = f"taskome-image-test:{uuid4().hex}"
    command = ["build", "--file", dockerfile, "--tag", image]
    for key, value in (build_args or {}).items():
        command.extend(["--build-arg", f"{key}={value}"])
    command.append(".")
    run_docker(*command)
    configured_user = run_docker(
        "image", "inspect", "--format", "{{.Config.User}}", image
    ).stdout.strip()
    if configured_user in {"", "0", "root"}:
        pytest.fail(f"{dockerfile} runtime image must configure a non-root user")
    architecture = run_docker(
        "image", "inspect", "--format", "{{.Architecture}}", image
    ).stdout.strip()
    if architecture != "amd64":
        pytest.fail(f"{dockerfile} runtime image must target linux/amd64")
    return image


def wait_for_healthy_container(container_name: str) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        health = run_docker(
            "inspect", "--format", "{{.State.Health.Status}}", container_name
        ).stdout.strip()
        if health == "healthy":
            return
        if health == "unhealthy":
            logs = run_docker("logs", container_name).stderr
            pytest.fail(f"Container became unhealthy:\n{logs}")
        time.sleep(0.5)
    pytest.fail("Container did not become healthy within 60 seconds")


def test_console_image_serves_the_spa_and_client_routes() -> None:
    image = build_image(
        "apps/console/Dockerfile",
        build_args={"VITE_SERVER_URL": "https://control-plane.example.test"},
    )

    with running_container(image, 8080) as origin:
        assert wait_for_response(origin).status_code == 200
        assert wait_for_response(origin, "/sign-in").status_code == 200
        assert (
            wait_for_response(origin, headers={"Accept-Encoding": "gzip"}).headers.get(
                "content-encoding"
            )
            == "gzip"
        )


def test_docs_image_serves_the_documentation_root() -> None:
    image = build_image("apps/docs/Dockerfile")

    with running_container(image, 4000) as origin:
        assert wait_for_response(origin).status_code == 200


def test_web_image_serves_the_marketing_root() -> None:
    image = build_image("apps/web/Dockerfile")

    with running_container(image, 3002) as origin:
        assert wait_for_response(origin).status_code == 200


def test_server_image_reports_liveness_without_a_database() -> None:
    image = build_image("apps/server/Dockerfile")

    with running_container(
        image,
        3000,
        environment={
            "BETTER_AUTH_SECRET": "container-test-secret-at-least-32-characters",
            "BETTER_AUTH_URL": "http://localhost:3000",
            "CORS_ORIGIN": "http://localhost:3001",
            "DATABASE_URL": "postgresql://taskome:taskome@127.0.0.1:5432/taskome",
            "NODE_ENV": "production",
        },
    ) as origin:
        response = wait_for_response(origin, "/healthz")
        assert response.status_code == 200
        assert json.loads(response.body) == {"status": "ok"}


def test_console_image_rejects_a_missing_server_url_build_argument() -> None:
    result = run_docker(
        "build",
        "--file",
        "apps/console/Dockerfile",
        ".",
        check=False,
    )

    assert result.returncode != 0
    assert "VITE_SERVER_URL build argument is required" in result.stderr
