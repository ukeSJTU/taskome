"""Gateway-owned SQLAlchemy models."""

from gateway.db.base import metadata
from gateway.models.input_files import InputFile

__all__ = ["InputFile", "metadata"]
