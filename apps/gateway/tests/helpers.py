from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    from gateway.db.database import Database


class AvailableDatabase:
    async def dispose(self) -> None:
        pass

    async def is_at_head(self) -> bool:
        return True

    async def is_available(self) -> bool:
        return True


available_database = cast("Database", AvailableDatabase())
