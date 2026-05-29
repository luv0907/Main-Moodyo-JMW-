"""
context_store.py — MoodyO Unified Cross-Surface Context Store
──────────────────────────────────────────────────────────────
v2: Every interaction across ALL surfaces (JARVIS voice, WhatsApp, Moodyo,
    Command Center) is written to a single `unified_thread` table with a
    `surface` tag. This gives every agent a shared 24-hour memory of what
    the user has been doing, regardless of which surface they used.

Schema
──────
  unified_thread  — one row per interaction, across all surfaces
  context_kv      — simple key/value store (mood, last_agent, etc.)

Backward Compatibility
──────────────────────
  save_command()   → shim → log_event()
  set_context()    → shim → set_kv()
  get_context()    → shim → get_kv()
  get_all_context()→ shim → returns kv dict
  build_context_summary() → uses cross-surface thread now
  get_pattern_insight()   → preserved (reads from unified_thread)
  get_recent_commands()   → shim → reads from unified_thread

All existing callers in server.py / intent_router.py work unchanged.
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

# Single write lock — prevents 'database is locked' under parallel ThreadPoolExecutor
_write_lock = threading.Lock()


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Initialisation ──────────────────────────────────────────────────────────

def init_context_db():
    """Create tables on first run. Migration-safe — adds columns if missing."""
    with _write_lock:
        conn = _get_conn()
        conn.executescript("""
            -- Unified cross-surface thread
            CREATE TABLE IF NOT EXISTS unified_thread (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT    NOT NULL,
                surface     TEXT    NOT NULL,   -- jarvis | whatsapp | moodyo | voice | command_center | core
                actor       TEXT    NOT NULL,   -- user | agent
                content     TEXT    NOT NULL,
                agent       TEXT,               -- which arm handled it (JARVIS / MOODYO / WHATSAPP)
                success     INTEGER,            -- 1 / 0 / NULL
                mood        TEXT,               -- mood at time of interaction
                metadata    TEXT                -- JSON blob for extras
            );

            -- Simple key/value context (mood, last_agent, etc.)
            CREATE TABLE IF NOT EXISTS context_kv (
                key         TEXT PRIMARY KEY,
                value       TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            -- Time-based and condition-based reminders
            CREATE TABLE IF NOT EXISTS reminders (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at  TEXT NOT NULL,
                remind_at   TEXT,           -- ISO timestamp, NULL = condition-based
                condition   TEXT,           -- 'on_startup' | 'on_mood:sad' | 'on_surface:jarvis'
                content     TEXT NOT NULL,  -- what to remind
                action      TEXT,           -- optional: JARVIS command to auto-execute
                fired       INTEGER DEFAULT 0,
                surface     TEXT DEFAULT 'all'
            );

            -- User-defined cron-scheduled tasks
            CREATE TABLE IF NOT EXISTS scheduled_tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                cron        TEXT NOT NULL,  -- '0 8 * * *' = 8am daily
                command     TEXT NOT NULL,  -- command to send to Core Brain
                label       TEXT,
                active      INTEGER DEFAULT 1,
                last_run    TEXT
            );
        """)

        # Migration: add surface/actor columns to legacy command_history if it still exists
        try:
            conn.execute("ALTER TABLE command_history ADD COLUMN surface TEXT DEFAULT 'core'")
            conn.commit()
            logger.info("[CONTEXT] Migrated command_history: added surface column")
        except Exception:
            pass  # column already exists or table doesn't exist — both fine

        conn.commit()
        conn.close()
    logger.info("[CONTEXT] Unified Context DB initialised at %s", DB_PATH)


# ─── Unified Thread (primary write path) ─────────────────────────────────────

def log_event(
    surface: str,
    actor: str,
    content: str,
    agent: str = None,
    success: bool = None,
    mood: str = None,
    metadata: dict = None
):
    """
    Write one interaction to the unified thread.

    Args:
        surface:  'jarvis' | 'whatsapp' | 'moodyo' | 'voice' | 'command_center' | 'core'
        actor:    'user' | 'agent'
        content:  The raw text of the command or reply
        agent:    Which MoodyO arm handled it (JARVIS / MOODYO / WHATSAPP)
        success:  True/False/None
        mood:     Mood at time of interaction
        metadata: Any extra JSON-serialisable dict
    """
    with _write_lock:
        conn = _get_conn()
        conn.execute("""
            INSERT INTO unified_thread
                (timestamp, surface, actor, content, agent, success, mood, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datetime.now().isoformat(),
            surface,
            actor,
            content,
            agent,
            1 if success is True else (0 if success is False else None),
            mood,
            json.dumps(metadata) if metadata else None
        ))
        conn.commit()
        conn.close()


def get_recent_thread(hours: int = 24, limit: int = 50) -> list:
    """
    Returns the last `limit` interactions from the last `hours` hours,
    newest first, across ALL surfaces.
    """
    cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
    conn = _get_conn()
    rows = conn.execute("""
        SELECT timestamp, surface, actor, content, agent, success, mood
        FROM unified_thread
        WHERE timestamp > ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (cutoff, limit)).fetchall()
    conn.close()
    return [
        {
            "timestamp": r["timestamp"],
            "surface":   r["surface"],
            "actor":     r["actor"],
            "content":   r["content"],
            "agent":     r["agent"],
            "success":   bool(r["success"]) if r["success"] is not None else None,
            "mood":      r["mood"],
        }
        for r in rows
    ]


# ─── Key-Value Store ──────────────────────────────────────────────────────────

def set_kv(key: str, value: str):
    with _write_lock:
        conn = _get_conn()
        conn.execute("""
            INSERT INTO context_kv (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE
                SET value=excluded.value, updated_at=excluded.updated_at
        """, (key, value, datetime.now().isoformat()))
        conn.commit()
        conn.close()


def get_kv(key: str, default: Optional[str] = None) -> Optional[str]:
    conn = _get_conn()
    row = conn.execute(
        "SELECT value FROM context_kv WHERE key = ?", (key,)
    ).fetchone()
    conn.close()
    return row["value"] if row else default


# ─── Cross-Surface Summary (injected into every AI call) ─────────────────────

def build_cross_surface_summary() -> str:
    """
    Builds a concise, token-efficient summary of the last 24h of interactions
    across ALL surfaces. Injected into every intent classification and JARVIS
    ReAct prompt so the AI has genuine ambient context.
    """
    thread = get_recent_thread(hours=24, limit=30)
    current_mood = get_kv("current_mood") or "unknown"

    if not thread:
        return f"Current mood: {current_mood}\nNo recent activity across surfaces."

    # Group by surface (chronological order = reversed since newest first)
    by_surface: dict[str, list[str]] = {
        "jarvis": [], "whatsapp": [], "moodyo": [],
        "voice": [], "command_center": [], "core": []
    }
    for event in reversed(thread):
        s = event["surface"]
        if s in by_surface:
            by_surface[s].append(event["content"])

    lines = [f"Current mood: {current_mood}"]

    if by_surface["whatsapp"]:
        lines.append(f"WhatsApp (last 24h): {'; '.join(by_surface['whatsapp'][-3:])}")
    if by_surface["voice"] or by_surface["jarvis"]:
        jarvis_items = (by_surface["voice"] + by_surface["jarvis"])[-3:]
        lines.append(f"JARVIS tasks: {'; '.join(jarvis_items)}")
    if by_surface["command_center"] or by_surface["core"]:
        cc_items = (by_surface["command_center"] + by_surface["core"])[-3:]
        lines.append(f"Command Center: {'; '.join(cc_items)}")
    if by_surface["moodyo"]:
        lines.append(f"Music: {'; '.join(by_surface['moodyo'][-2:])}")

    # Cross-surface pattern detection
    all_contents = [e["content"].lower() for e in thread]
    if any("email" in c or "gmail" in c for c in all_contents):
        lines.append("Pattern: User has been dealing with email tasks")
    if any("meeting" in c or "calendar" in c for c in all_contents):
        lines.append("Pattern: Meeting/calendar activity detected")
    if any("remind" in c for c in all_contents):
        lines.append("Pattern: User has set or mentioned a reminder")

    return "\n".join(lines)


def get_context_summary() -> dict:
    """Full context dict for dashboard /context endpoint."""
    return {
        "current_mood":          get_kv("current_mood"),
        "last_agent":            get_kv("last_agent"),
        "cross_surface_summary": build_cross_surface_summary(),
        "recent_thread":         get_recent_thread(hours=2, limit=10),
    }


# ─── Backward-Compatibility Shims ─────────────────────────────────────────────
# All existing callers in server.py / intent_router.py continue working
# without any changes.

def save_command(
    command: str,
    intent: dict = None,
    agent: str = "JARVIS",
    success: bool = True,
    error: str = None,
    surface: str = "core"
):
    """Shim: maps old save_command() signature → log_event()."""
    mood = get_kv("current_mood")
    metadata = {"intent": intent, "error": error} if (intent or error) else None
    log_event(
        surface=surface,
        actor="user",
        content=command,
        agent=agent,
        success=success,
        mood=mood,
        metadata=metadata,
    )


def set_context(key: str, value: str):
    """Shim: maps old set_context() → set_kv()."""
    set_kv(key, value)


def get_context(key: str, default: Optional[str] = None) -> Optional[str]:
    """Shim: maps old get_context() → get_kv()."""
    return get_kv(key, default)


def get_all_context() -> dict:
    """Shim: returns all kv pairs as a dict (used by /context endpoint)."""
    conn = _get_conn()
    rows = conn.execute("SELECT key, value FROM context_kv").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


def get_recent_commands(limit: int = 5) -> list[dict]:
    """
    Shim: returns recent interactions from unified_thread in the old
    command_history format so /context endpoint keeps working.
    """
    conn = _get_conn()
    rows = conn.execute("""
        SELECT content, agent, surface, success, metadata, timestamp
        FROM unified_thread
        ORDER BY id DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        meta = {}
        try:
            meta = json.loads(r["metadata"]) if r["metadata"] else {}
        except Exception:
            pass
        result.append({
            "command":    r["content"],
            "intent":     meta.get("intent", {}),
            "agent":      r["agent"] or "?",
            "surface":    r["surface"],
            "success":    bool(r["success"]) if r["success"] is not None else True,
            "error":      meta.get("error"),
            "created_at": r["timestamp"],
        })
    return result


def build_context_summary() -> str:
    """
    Shim: old callers (intent_router.py) call this. Now returns the
    rich cross-surface summary instead of the flat history summary.
    """
    return build_cross_surface_summary()


def get_pattern_insight() -> Optional[str]:
    """
    Detects cross-surface patterns from unified_thread.
    Preserved for /context endpoint and dashboard.
    """
    try:
        thread = get_recent_thread(hours=2, limit=10)
        if len(thread) < 3:
            return None

        agents   = [e["agent"] for e in thread if e["agent"]]
        surfaces = [e["surface"] for e in thread]
        contents = [e["content"].lower() for e in thread]

        # Pattern: Three JARVIS commands → deep work mode
        if agents[:3] == ["JARVIS", "JARVIS", "JARVIS"]:
            return "User appears to be in deep work/focus mode — if asked, suggest focus music"

        # Pattern: Two or more sad/depressed moods → low mood
        moods = [e["mood"] for e in thread if e["mood"] in ("sad", "depressed")]
        if len(moods) >= 2:
            return "User has been in a low mood — if relevant, gently acknowledge and suggest something uplifting"

        # Pattern: WhatsApp heavy usage
        if surfaces[:5].count("whatsapp") >= 3:
            return "User has been messaging heavily — they may be coordinating something important"

        # Pattern: Cross-surface reminder mention
        if any("remind" in c for c in contents):
            return "User mentioned a reminder recently — proactively offer to follow up"

    except Exception as e:
        logger.debug(f"[CONTEXT] Pattern insight error (non-critical): {e}")

    return None


# ─── Reminder & Scheduled Task CRUD ────────────────────────────────────────────────────────────────────────

def add_reminder(
    content: str,
    remind_at: str = None,
    condition: str = None,
    action: str = None,
    surface: str = "all"
):
    """
    Schedule a reminder.

    Args:
        content:   What to remind the user about (displayed in the banner)
        remind_at: ISO timestamp for time-based reminder (e.g. "2026-05-30T08:00:00")
        condition: Trigger condition: 'on_startup' | 'on_mood:sad' | None (time-only)
        action:    Optional JARVIS command to auto-execute when reminder fires
        surface:   Which surface to surface it on ('all' = everywhere)
    """
    with _write_lock:
        conn = _get_conn()
        conn.execute("""
            INSERT INTO reminders (created_at, remind_at, condition, content, action, surface)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (datetime.now().isoformat(), remind_at, condition, content, action, surface))
        conn.commit()
        conn.close()
    logger.info(f"[CONTEXT] Reminder added: '{content}' condition={condition} remind_at={remind_at}")


def get_pending_reminders(condition: str = None) -> list:
    """
    Returns unfired reminders that are due.

    If condition is given, also matches 'on_startup' reminders (so startup
    reminders always surface on first check regardless of condition type).
    """
    conn = _get_conn()
    now = datetime.now().isoformat()

    if condition:
        rows = conn.execute("""
            SELECT id, content, action FROM reminders
            WHERE fired=0
              AND (condition=? OR condition='on_startup')
              AND (remind_at IS NULL OR remind_at <= ?)
        """, (condition, now)).fetchall()
    else:
        rows = conn.execute("""
            SELECT id, content, action FROM reminders
            WHERE fired=0
              AND (remind_at IS NULL OR remind_at <= ?)
        """, (now,)).fetchall()

    conn.close()
    return [{"id": r["id"], "content": r["content"], "action": r["action"]} for r in rows]


def mark_reminder_fired(reminder_id: int):
    """Mark a reminder as fired so it doesn't trigger again."""
    with _write_lock:
        conn = _get_conn()
        conn.execute("UPDATE reminders SET fired=1 WHERE id=?", (reminder_id,))
        conn.commit()
        conn.close()


def get_all_reminders(include_fired: bool = False) -> list:
    """Return all reminders — used by the dashboard /reminders endpoint."""
    conn = _get_conn()
    query = "SELECT * FROM reminders" if include_fired else "SELECT * FROM reminders WHERE fired=0"
    rows = conn.execute(query + " ORDER BY id DESC").fetchall()
    conn.close()
    return [
        {
            "id":         r["id"],
            "created_at": r["created_at"],
            "remind_at":  r["remind_at"],
            "condition":  r["condition"],
            "content":    r["content"],
            "action":     r["action"],
            "fired":      bool(r["fired"]),
            "surface":    r["surface"],
        }
        for r in rows
    ]


def add_scheduled_task(cron: str, command: str, label: str = None):
    """Register a cron-based recurring task."""
    with _write_lock:
        conn = _get_conn()
        conn.execute("""
            INSERT INTO scheduled_tasks (cron, command, label)
            VALUES (?, ?, ?)
        """, (cron, command, label))
        conn.commit()
        conn.close()
    logger.info(f"[CONTEXT] Scheduled task added: '{label}' @ {cron}")


def get_active_scheduled_tasks() -> list:
    """Returns all active cron tasks — loaded by proactive_engine at startup."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, cron, command, label FROM scheduled_tasks WHERE active=1"
    ).fetchall()
    conn.close()
    return [{"id": r["id"], "cron": r["cron"], "command": r["command"], "label": r["label"]} for r in rows]


# ─── Auto-init ───────────────────────────────────────────────────────────────
# Runs on import so callers never need to call init_context_db() first.
try:
    init_context_db()
except Exception as _e:
    logger.warning(f"[CONTEXT] Auto-init failed (will retry on next call): {_e}")
