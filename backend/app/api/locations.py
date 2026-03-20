import asyncio
import json
import re
import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

_SHARD_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "location_shards"

# Characters that are meaningful to FTS5 query syntax
_FTS5_SPECIAL = re.compile(r'[^\w\s]', re.UNICODE)

# Shard map: uppercase letter -> shard filename stem  (loaded once)
_shard_map: dict[str, str] = {}

# Connection pool: shard_name -> sqlite3.Connection
_conns: dict[str, sqlite3.Connection] = {}


def _load_shard_map() -> None:
    global _shard_map
    if _shard_map:
        return
    map_path = _SHARD_DIR / "shard_map.json"
    if not map_path.exists():
        raise FileNotFoundError(
            f"Shard map not found at {map_path}. "
            "Run: python build_location_shards.py"
        )
    with open(map_path) as f:
        _shard_map = json.load(f)


def _get_shard_conn(shard_name: str) -> sqlite3.Connection:
    if shard_name not in _conns:
        db_path = _SHARD_DIR / f"locations_{shard_name}.db"
        if not db_path.exists():
            raise FileNotFoundError(f"Shard DB not found: {db_path}")
        conn = sqlite3.connect(str(db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA mmap_size=67108864")  # 64 MB mmap per shard
        _conns[shard_name] = conn
    return _conns[shard_name]


def _resolve_shard(query: str) -> str:
    """Determine which shard to query based on the first letter of the search."""
    _load_shard_map()
    # Extract the first alphabetic character from the query
    for ch in query:
        if ch.isalpha():
            return _shard_map.get(ch.upper(), _shard_map.get("_default", "other"))
    return _shard_map.get("_default", "other")


def _sanitize_fts_query(raw: str) -> str | None:
    """Strip FTS5 operators/special chars and build a safe prefix query."""
    cleaned = _FTS5_SPECIAL.sub(' ', raw)
    tokens = cleaned.split()
    if not tokens:
        return None
    # prefix-match on the last token; exact match earlier tokens
    return ' '.join(tokens[:-1] + [tokens[-1] + '*'])


def _sync_search(shard_name: str, fts_query: str, limit: int) -> list[dict]:
    """Run the FTS query on the appropriate shard."""
    conn = _get_shard_conn(shard_name)
    cursor = conn.execute(
        """
        SELECT
            COALESCE(l.name, '') || ', ' || COALESCE(s.name, '') || ', ' || COALESCE(c.name, '') AS label,
            lt.name AS type
        FROM locations_fts fts
        JOIN locations l ON l.id = fts.rowid
        LEFT JOIN states s ON s.id = l.state_id
        LEFT JOIN countries c ON c.id = l.country_id
        LEFT JOIN loc_types lt ON lt.id = l.loc_type_id
        WHERE locations_fts MATCH ?
        ORDER BY l.population DESC
        LIMIT ?
        """,
        (fts_query, limit),
    )
    return [dict(r) for r in cursor.fetchall()]


@router.get("/search")
async def search_locations(
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=8, ge=1, le=50),
):
    """Search locations using FTS5 full-text index (sharded by first letter)."""
    fts_query = _sanitize_fts_query(q)
    if not fts_query:
        return []

    try:
        shard_name = _resolve_shard(q)
        return await asyncio.to_thread(_sync_search, shard_name, fts_query, limit)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
