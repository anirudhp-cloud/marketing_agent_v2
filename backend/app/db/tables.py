import aiosqlite

SESSIONS_TABLE = """
CREATE TABLE IF NOT EXISTS sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT UNIQUE NOT NULL,
    data             TEXT NOT NULL DEFAULT '{}',
    current_step     INTEGER DEFAULT 1,
    human_approved   INTEGER DEFAULT 0,
    pipeline_state   TEXT DEFAULT 'idle',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
)
"""

VARIANTS_TABLE = """
CREATE TABLE IF NOT EXISTS variants (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT NOT NULL REFERENCES sessions(session_id),
    angle            TEXT NOT NULL,
    headline         TEXT NOT NULL,
    copy_text        TEXT NOT NULL,
    cta              TEXT NOT NULL,
    target_segment   TEXT,
    imagery_style    TEXT,
    image_url        TEXT,
    video_url        TEXT,
    image_prompt     TEXT,
    video_prompt     TEXT,
    hashtags         TEXT,
    score            REAL,
    is_recommended   INTEGER DEFAULT 0,
    compliance_status TEXT DEFAULT 'unchecked',
    compliance_issues TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
)
"""

CALENDAR_POSTS_TABLE = """
CREATE TABLE IF NOT EXISTS calendar_posts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT NOT NULL REFERENCES sessions(session_id),
    variant_id       INTEGER REFERENCES variants(id),
    post_date        TEXT NOT NULL,
    post_type        TEXT NOT NULL,
    caption          TEXT,
    hashtags         TEXT,
    best_time        TEXT,
    image_url        TEXT,
    status           TEXT DEFAULT 'scheduled',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
)
"""


async def create_tables(db: aiosqlite.Connection) -> None:
    await db.execute(SESSIONS_TABLE)
    await db.execute(VARIANTS_TABLE)
    await db.execute(CALENDAR_POSTS_TABLE)
    # Migration: add hashtags column if missing (for existing DBs)
    try:
        await db.execute("ALTER TABLE variants ADD COLUMN hashtags TEXT")
    except Exception:
        pass  # column already exists
    # Migration: add video_prompt column if missing
    try:
        await db.execute("ALTER TABLE variants ADD COLUMN video_prompt TEXT")
    except Exception:
        pass  # column already exists
