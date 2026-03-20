"""Verify context_composer reads real UI session data correctly."""
import asyncio
import aiosqlite

async def main():
    db = await aiosqlite.connect("d:/retail_/marketing_agent_v2/backend/retail_marketing.db")
    db.row_factory = aiosqlite.Row
    
    # Import and test with the most recent real UI session
    import sys
    sys.path.insert(0, "d:/retail_/marketing_agent_v2/backend")
    from app.services.context_composer import compose_context
    
    # Get real UI session IDs
    cur = await db.execute("SELECT session_id FROM sessions WHERE session_id LIKE 'insta_%' ORDER BY id DESC LIMIT 1")
    row = await cur.fetchone()
    if not row:
        print("No real UI sessions found")
        return
    
    sid = row["session_id"]
    print(f"Testing with session: {sid}\n")
    
    ctx = await compose_context(db, sid)
    
    print("=== COMPOSED CONTEXT ===")
    for k, v in ctx.items():
        val = str(v)[:100]
        status = "✅" if v and v != "" and v != [] and v != 0 else "⚠️  EMPTY"
        print(f"  {status}  {k}: {val}")
    
    # Count populated vs empty
    populated = sum(1 for v in ctx.values() if v and v != "" and v != [] and v != 0)
    total = len(ctx)
    print(f"\n{populated}/{total} fields populated")
    
    await db.close()

asyncio.run(main())
