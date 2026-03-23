"""Quick debug script — check logo data in recent sessions."""
import sqlite3, json
from pathlib import Path

db_path = Path(__file__).parent / "retail_marketing.db"
if not db_path.exists():
    print(f"DB not found: {db_path}")
    exit(1)

conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cur = conn.execute("SELECT session_id, data FROM sessions ORDER BY rowid DESC LIMIT 3")
rows = cur.fetchall()

for r in rows:
    blob = json.loads(r["data"])
    bp = blob.get("business_profile", {})
    logo_url = bp.get("logoUrl", "<NOT SET>")
    logo_placement = bp.get("logoPlacement", "<NOT SET>")
    print(f"SESSION: {r['session_id']}")
    print(f"  logoUrl:       {logo_url}")
    print(f"  logoPlacement: {logo_placement}")

    # Check if _resolve_logo_path would find this
    if logo_url and logo_url != "<NOT SET>":
        from urllib.parse import urlparse, unquote
        if "://" in logo_url:
            path = unquote(urlparse(logo_url).path)
        else:
            path = unquote(logo_url)
        print(f"  parsed path:   {path}")

        if path.startswith("/static/"):
            local = Path(__file__).parent / "static" / path[len("/static/"):]
            print(f"  local path:    {local}")
            print(f"  exists:        {local.exists()}")
        else:
            print(f"  WARNING: path does not start with /static/")
    print()

# Also list files in static/uploads
uploads = Path(__file__).parent / "static" / "uploads"
if uploads.exists():
    files = list(uploads.iterdir())
    print(f"Files in {uploads} ({len(files)}):")
    for f in files:
        print(f"  {f.name}  ({f.stat().st_size} bytes)")
else:
    print(f"Upload dir does not exist: {uploads}")

conn.close()
