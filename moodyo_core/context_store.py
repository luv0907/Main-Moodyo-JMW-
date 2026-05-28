"""
context_store.py — MoodyO Shared Context Store
────────────────────────────────────────────────
Lightweight SQLite store that gives the Core Brain persistent memory:

  • current_mood    — last detected mood (set by Moodyo or voice)
  • command_history — last 10 commands with their intents + results
  • active_tasks    — commands that were dispatched but not yet confirmed done

This context is injected into every intent classification call so the AI
knows what the user was doing before, making routing smarter.

Example: if the user said "play something sad" 30 seconds ago, and now says
"pause it", the AI knows "it" = the Moodyo music player.
"""
import sqlite3
import json
import os
import logging
import threading
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), 'moodyo_context.db')
HISTORY_LIMIT = 10

# Single write lock — prevents 'database is locked' when parallel agents
# call save_command() simultaneously via ThreadPoolExecutor
_write_lock = threading.Lock()


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_context_db():
    """Create tables on first run. Safe to call multiple times."""
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS context_kv (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS command_history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            command    TEXT NOT NULL,
            intent     TEXT NOT NULL,
            agent      TEXT NOT NULL,
            success    INTEGER NOT NULL,
            error      TEXT,
            created_at TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()
    logger.info("[CONTEXT] Context DB initialized at %s", DB_PATH)


# ─── Key-Value store (mood, etc.) ────────────────────────────────────────────

def set_context(key: str, value: str):
    with _write_lock:
        conn = _get_conn()
        conn.execute("""
            INSERT INTO context_kv (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
        """, (key, value, datetime.now().isoformat()))
        conn.commit()
        conn.close()


def get_context(key: str, default: Optional[str] = None) -> Optional[str]:
    conn = _get_conn()
    row = conn.execute("SELECT value FROM context_kv WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def get_all_context() -> dict:
    conn = _get_conn()
    rows = conn.execute("SELECT key, value FROM context_kv").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


# ─── Command history ─────────────────────────────────────────────────────────

def save_command(command: str, intent: dict, agent: str, success: bool, error: str = None):
    with _write_lock:
        conn = _get_conn()
        conn.execute("""
            INSERT INTO command_history (command, intent, agent, success, error, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            command,
            json.dumps(intent),
            agent,
            1 if success else 0,
            error,
            datetime.now().isoformat()
        ))
        # Trim to HISTORY_LIMIT rows
        conn.execute("""
            DELETE FROM command_history WHERE id NOT IN (
                SELECT id FROM command_history ORDER BY id DESC LIMIT ?
            )
        """, (HISTORY_LIMIT,))
        conn.commit()
        conn.close()


def get_recent_commands(limit: int = 5) -> list[dict]:
    conn = _get_conn()
    rows = conn.execute("""
        SELECT command, intent, agent, success, error, created_at
        FROM command_history
        ORDER BY id DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        result.append({
            "command": r["command"],
            "intent": json.loads(r["intent"]),
            "agent": r["agent"],
            "success": bool(r["success"]),
            "error": r["error"],
            "created_at": r["created_at"],
        })
    return result


def build_context_summary() -> str:
    """
    Returns a compact text summary of recent context to inject into the
    AI system prompt. Keeps it short so it doesn't bloat the token count.
    """
    ctx = get_all_context()
    history = get_recent_commands(5)

    lines = []
    
    # Inject session summary at the top
    session_summary = summarize_session()
    lines.append(f"Session state: {session_summary}")
    if ctx.get("current_mood"):
        lines.append(f"Current mood: {ctx['current_mood']}")
    if ctx.get("last_agent"):
        lines.append(f"Last agent used: {ctx['last_agent']}")

    if history:
        lines.append("Recent commands:")
        for h in history:
            status = "\u2713" if h["success"] else "\u2717"
            lines.append(f"  {status} [{h['agent']}] \"{h['command']}\"")

    # Inject proactive insight if a pattern is detected
    insight = get_pattern_insight()
    if insight:
        lines.append(f"\nSYSTEM NOTE: {insight}")

    return "\n".join(lines) if lines else "No prior context."


SESSION_GAP_MINUTES = 30  # gap longer than this = new session

def get_current_session() -> list:
    """Returns only commands from the current unbroken session."""
    recent = get_recent_commands(20)
    if not recent:
        return []
    
    session = [recent[0]]
    for i in range(1, len(recent)):
        current_time = datetime.fromisoformat(recent[i]["created_at"])
        prev_time = datetime.fromisoformat(recent[i-1]["created_at"])
        gap = (prev_time - current_time).total_seconds() / 60
        
        if gap > SESSION_GAP_MINUTES:
            break  # session boundary — stop here
        session.append(recent[i])
    
    return session

def summarize_session() -> str:
    """Gives the AI a one-line summary of what's happening right now."""
    session = get_current_session()
    if not session:
        return "Fresh session — no context yet"
    
    agents_used = set(c["agent"] for c in session)
    duration_mins = max(1, len(session) * 2)  # rough estimate
    
    parts = []
    if "JARVIS" in agents_used:
        parts.append("doing PC work")
    if "MOODYO" in agents_used:
        parts.append("listening to music")
    if "WHATSAPP" in agents_used:
        parts.append("coordinating via WhatsApp")
    
    return f"Active session ({duration_mins}+ min): {', '.join(parts)}"


def get_pattern_insight() -> Optional[str]:
    """
    Detects patterns in recent command history and returns a proactive nudge
    that gets injected into the AI system prompt.

    This is what makes the system feel like a companion rather than a router:
    it notices what you're doing and can suggest things without being asked.
    """
    try:
        recent = get_recent_commands(10)
        
        # Only consider commands from the last 2 hours (filters out test spam)
        cutoff = datetime.now() - timedelta(hours=2)
        recent = [
            c for c in recent 
            if datetime.fromisoformat(c["created_at"]) > cutoff
        ]
        
        if len(recent) < 3:
            return None

        agents = [c["agent"] for c in recent]
        intents = [c["intent"] for c in recent]

        # Pattern 1: Three JARVIS commands in a row → user is in work/focus mode
        if agents[:3] == ["JARVIS", "JARVIS", "JARVIS"]:
            return "User appears to be in deep work/focus mode — if asked, suggest focus music (joyfull or happy)"

        # Pattern 2: Two or more sad/depressed moods recently → user mood is low
        moods = [
            i.get("mood") for i in intents
            if isinstance(i, dict) and i.get("intent") == "MUSIC" and i.get("mood")
        ]
        if len(moods) >= 2 and all(m in ("sad", "depressed") for m in moods[:2]):
            return "User has been in a low mood — if relevant, gently acknowledge and suggest something uplifting"

        # Pattern 3: Alternating JARVIS + MUSIC → user is working with background music
        if len(agents) >= 4:
            work_music_pattern = all(
                (agents[i] == "JARVIS" and agents[i+1] == "MOODYO") or
                (agents[i] == "MOODYO" and agents[i+1] == "JARVIS")
                for i in range(0, min(4, len(agents)-1), 2)
            )
            if work_music_pattern:
                return "User is in a work + music session — keep it flowing, avoid interruptions"

        # Pattern 4: WhatsApp heavy usage → user is communicating a lot
        whatsapp_count = agents[:5].count("WHATSAPP")
        if whatsapp_count >= 3:
            return "User has been messaging heavily — they may be coordinating something important"

    except Exception as e:
        logger.debug(f"[CONTEXT] Pattern insight error (non-critical): {e}")

    return None
