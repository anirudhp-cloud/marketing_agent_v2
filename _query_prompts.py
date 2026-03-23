import sqlite3
import glob
import os

# Find all .db files
db_files = glob.glob("*.db") + glob.glob("backend/*.db")
print("Database files found:", db_files)

for db_file in db_files:
    print(f"\n=== Checking {db_file} ===")
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    tables = [t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print(f"Tables: {tables}")
    if "variants" in tables:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, session_id, angle, image_prompt FROM variants "
            "WHERE image_prompt IS NOT NULL AND image_prompt != '' "
            "ORDER BY id DESC LIMIT 5"
        )
        rows = cur.fetchall()
        if not rows:
            print("No variants with image_prompt found.")
        else:
            for r in rows:
                print(f"\n--- Variant {r['id']} (session: {r['session_id']}) ---")
                print(f"Angle: {r['angle']}")
                print(f"Image Prompt:\n{r['image_prompt']}")
    conn.close()
