"""Test-session setup shared by the whole fpocket Task Server test suite."""

from __future__ import annotations

import os
from pathlib import Path

_LOCAL_BUILD = Path(__file__).resolve().parent.parent / "compute" / "bin" / "fpocket"

# `mise run //apps/task-fpocket:test` builds this via the `compute:build` task
# before pytest runs. Only default it here so `FPOCKET_BINARY` set by a real
# deployment (or a developer testing a different binary) always wins.
os.environ.setdefault("FPOCKET_BINARY", str(_LOCAL_BUILD))
