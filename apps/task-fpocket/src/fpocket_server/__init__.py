"""Taskome's fpocket Task Server package."""

import uvicorn


def main() -> None:
    """Serve the fpocket Task Server as the required single synchronous worker."""
    uvicorn.run("fpocket_server.app:app", host="0.0.0.0", port=8000, workers=1)  # noqa: S104
