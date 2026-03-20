"""
Build location database shards from the compact source DB.

Each shard contains a subset of locations (grouped by first letter),
its own FTS5 index, and copies of the lookup tables.

Target: each shard < 95 MB so it fits in GitHub (100 MB limit).

Usage:
    python build_location_shards.py
"""
import sqlite3
import os
import sys
import time
from pathlib import Path

SRC = Path(__file__).parent / "locations_v2_compact.db"
SHARD_DIR = Path(__file__).parent / "backend" / "data" / "location_shards"

# Letter groups — each group becomes one shard file.
# Grouped to keep each shard under ~95 MB (based on 74 bytes/row).
# Max ~1.28M rows per shard.
SHARD_GROUPS = {
    "s":      list("S"),
    "b":      list("B"),
    "k":      list("K"),
    "c":      list("C"),
    "m":      list("M"),
    "l":      list("L"),
    "p":      list("P"),
    "a":      list("A"),
    "d_e":    list("DE"),
    "g_f":    list("GF"),
    "h_i":    list("HI"),
    "t_u":    list("TU"),
    "r_q":    list("RQ"),
    "n_o":    list("NO"),
    "w_j_v":  list("WJV"),
    "x_y_z":  list("XYZ"),
    "other":  None,  # everything not matched above
}

# Build a mapping from uppercase letter -> shard name
LETTER_TO_SHARD = {}
ALL_ASSIGNED = set()
for shard_name, letters in SHARD_GROUPS.items():
    if letters:
        for ch in letters:
            LETTER_TO_SHARD[ch.upper()] = shard_name
            ALL_ASSIGNED.add(ch.upper())


def copy_lookup_tables(src_conn, dst_conn):
    sc = src_conn.cursor()
    dc = dst_conn.cursor()
    for table in ['countries', 'states', 'districts', 'loc_types']:
        sc.execute(f"SELECT sql FROM sqlite_master WHERE name=?", (table,))
        dc.execute(sc.fetchone()[0])
        sc.execute(f"SELECT * FROM {table}")
        rows = sc.fetchall()
        if rows:
            placeholders = ','.join(['?'] * len(rows[0]))
            dc.executemany(f"INSERT INTO {table} VALUES ({placeholders})", rows)
    dst_conn.commit()


def create_locations_table(dst_conn):
    dst_conn.execute("""CREATE TABLE locations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        country_id INTEGER REFERENCES countries(id),
        state_id INTEGER REFERENCES states(id),
        district_id INTEGER REFERENCES districts(id),
        population INTEGER DEFAULT 0,
        loc_type_id INTEGER REFERENCES loc_types(id)
    )""")


def build_fts(dst_conn):
    dc = dst_conn.cursor()
    dc.execute("""
        CREATE VIRTUAL TABLE locations_fts USING fts5(
            name,
            hierarchy,
            content='',
            tokenize='unicode61 remove_diacritics 2'
        )
    """)
    dc.execute("""
        INSERT INTO locations_fts(rowid, name, hierarchy)
        SELECT l.id,
               l.name,
               COALESCE(s.name,'') || ' ' || COALESCE(c.name,'')
        FROM locations l
        LEFT JOIN states s ON s.id = l.state_id
        LEFT JOIN countries c ON c.id = l.country_id
    """)
    dst_conn.commit()


def build_shard(src_conn, shard_name, letters):
    shard_path = SHARD_DIR / f"locations_{shard_name}.db"
    if shard_path.exists():
        shard_path.unlink()

    dst_conn = sqlite3.connect(str(shard_path))
    dst_conn.execute("PRAGMA journal_mode=WAL")
    dst_conn.execute("PRAGMA synchronous=OFF")
    dst_conn.execute("PRAGMA temp_store=MEMORY")

    copy_lookup_tables(src_conn, dst_conn)
    create_locations_table(dst_conn)

    sc = src_conn.cursor()
    dc = dst_conn.cursor()

    if letters:
        placeholders = ','.join(['?'] * len(letters))
        sc.execute(
            f"SELECT * FROM locations WHERE UPPER(SUBSTR(name,1,1)) IN ({placeholders})",
            [ch.upper() for ch in letters]
        )
    else:
        # "other" shard — everything not in any assigned letter
        assigned = list(ALL_ASSIGNED)
        placeholders = ','.join(['?'] * len(assigned))
        sc.execute(
            f"SELECT * FROM locations WHERE UPPER(SUBSTR(name,1,1)) NOT IN ({placeholders})",
            assigned
        )

    rows = sc.fetchall()
    dc.executemany("INSERT INTO locations VALUES (?,?,?,?,?,?,?)", rows)
    dst_conn.commit()

    build_fts(dst_conn)

    # VACUUM to compact
    dc.execute("VACUUM")
    dst_conn.commit()
    dst_conn.close()

    size_mb = shard_path.stat().st_size / 1e6
    return len(rows), size_mb


def main():
    if not SRC.exists():
        print(f"ERROR: Source DB not found: {SRC}")
        print("Run compact_db.py first to create it.")
        sys.exit(1)

    SHARD_DIR.mkdir(parents=True, exist_ok=True)

    src_conn = sqlite3.connect(str(SRC))
    src_conn.row_factory = None

    # Verify source row count
    total_src = src_conn.execute("SELECT COUNT(*) FROM locations").fetchone()[0]
    print(f"Source: {total_src:,} locations in {SRC.name}")
    print(f"Output: {SHARD_DIR}\n")

    total_rows = 0
    total_size = 0
    t0 = time.time()

    for shard_name, letters in SHARD_GROUPS.items():
        label = ','.join(letters) if letters else '(other)'
        print(f"  Building shard '{shard_name}' [{label}]...", end=" ", flush=True)
        st = time.time()
        count, size_mb = build_shard(src_conn, shard_name, letters)
        total_rows += count
        total_size += size_mb
        print(f"{count:>10,} rows  {size_mb:>6.1f} MB  ({time.time()-st:.1f}s)")

    src_conn.close()

    print(f"\n{'='*60}")
    print(f"  Total rows:  {total_rows:,}  (source: {total_src:,})")
    print(f"  Total size:  {total_size:.1f} MB")
    print(f"  Shards:      {len(SHARD_GROUPS)}")
    print(f"  Time:        {time.time()-t0:.1f}s")

    if total_rows != total_src:
        print(f"\n  *** WARNING: ROW COUNT MISMATCH! Lost {total_src - total_rows:,} rows ***")
    else:
        print(f"\n  All {total_src:,} rows preserved across {len(SHARD_GROUPS)} shards.")

    # Write the shard map as a JSON file for the backend to load
    import json
    shard_map = {}
    for shard_name, letters in SHARD_GROUPS.items():
        if letters:
            for ch in letters:
                shard_map[ch.upper()] = shard_name
    shard_map["_default"] = "other"

    map_path = SHARD_DIR / "shard_map.json"
    with open(map_path, "w") as f:
        json.dump(shard_map, f, indent=2)
    print(f"  Shard map written to {map_path}")


if __name__ == "__main__":
    main()
