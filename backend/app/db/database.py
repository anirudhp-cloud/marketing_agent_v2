import aiosqlite
from pathlib import Path

_db: aiosqlite.Connection | None = None

DB_PATH = Path(__file__).resolve().parent.parent.parent / "retail_marketing.db"


async def get_db() -> aiosqlite.Connection:
    if _db is None:
        raise RuntimeError("Database not initialized — call init_db() first")
    return _db


async def init_db() -> None:
    global _db
    _db = await aiosqlite.connect(str(DB_PATH))
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA foreign_keys=ON")

    from app.db.tables import create_tables

    await create_tables(_db)
    await _db.commit()


async def close_db() -> None:
    global _db
    if _db:
        await _db.close()
        _db = None
