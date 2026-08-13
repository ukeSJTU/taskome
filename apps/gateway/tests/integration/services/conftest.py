from __future__ import annotations

import json
import os
import tempfile
from typing import TYPE_CHECKING

import pytest
from gateway.services.storage import SeaweedFSStorage
from testcontainers.core.container import DockerContainer
from testcontainers.core.wait_strategies import HttpWaitStrategy

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture(scope="module")
def storage() -> Iterator[SeaweedFSStorage]:
    """One real SeaweedFS container per test module — shared because it has no
    per-test state to isolate; each test uses its own object key."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as config_file:
        json.dump(
            {
                "identities": [
                    {
                        "name": "test",
                        "credentials": [
                            {
                                "accessKey": "test-access-key",
                                "secretKey": "test-secret-key",
                            }
                        ],
                        "actions": ["Read", "Write", "List", "Tagging", "Admin"],
                    }
                ]
            },
            config_file,
        )
        config_file.flush()
        os.fchmod(config_file.fileno(), 0o644)
        with (
            DockerContainer(
                "chrislusf/seaweedfs:latest",
                command=(
                    "server -dir=/data -s3 "
                    "-s3.config=/etc/seaweedfs/s3-config.json "
                    "-s3.allowedOrigins=http://localhost:3000"
                ),
            )
            .with_exposed_ports(8333)
            .waiting_for(HttpWaitStrategy(8333, "/status").with_startup_timeout(90))
            .with_volume_mapping(config_file.name, "/etc/seaweedfs/s3-config.json") as seaweedfs
        ):
            endpoint = (
                f"http://{seaweedfs.get_container_host_ip()}:{seaweedfs.get_exposed_port(8333)}"
            )
            yield SeaweedFSStorage(
                internal_endpoint=endpoint,
                public_endpoint=endpoint,
                access_key="test-access-key",
                secret_key="test-secret-key",  # noqa: S106
                bucket="taskome-test",
            )
