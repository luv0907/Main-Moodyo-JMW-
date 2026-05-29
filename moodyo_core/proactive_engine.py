"""
proactive_engine.py — MoodyO Proactive Trigger Engine
───────────────────────────────────────────────────────
APScheduler background scheduler that runs inside the Core Brain process.
Every N minutes it checks conditions and fires actions autonomously —
no user input required.

Triggers built in:
  • check_startup_reminders() — fires once on startup for on_startup conditions
  • check_timed_reminders()   — every 1 min: fires time-based reminders that are due
  • check_mood_triggers()     — every 5 min: fires on_mood:<mood> reminders
  • check_pattern_triggers()  — every 10 min: work mode detection → suggest music
  • _load_scheduled_tasks()   — loads user-defined cron tasks from DB

Public API:
  start_proactive_engine()   — call once at FastAPI startup
  stop_proactive_engine()    — call at FastAPI shutdown
"""
import logging
import requests
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from context_store import (
    get_pending_reminders, mark_reminder_fired,
    get_active_scheduled_tasks, get_kv, set_kv, log_event,
    build_cross_surface_summary
)

logger = logging.getLogger(__name__)

# Single scheduler instance (thread-safe, daemon=True so it dies with the process)
scheduler = BackgroundScheduler(
    timezone="Asia/Kolkata",
    daemon=True,
)

CORE_URL = "http://localhost:8000"

# ─── Internal helpers ─────────────────────────────────────────────────────────

def _fire_command(command: str, source: str = "proactive"):
    """
    Send a command to Core Brain as if the user typed it.
    Logs the proactive action to the unified thread.
    """
    try:
        r = requests.post(
            f"{CORE_URL}/command",
            json={"command": command, "surface": "proactive"},
            timeout=30
        )
        log_event(
            surface="proactive",
            actor="agent",
            content=f"[AUTO] {command}",
            agent="JARVIS",
            success=r.ok,
        )
        logger.info(f"[PROACTIVE] Fired: '{command}' → {r.status_code}")
    except Exception as e:
        logger.error(f"[PROACTIVE] Failed to fire '{command}': {e}")


def _push_notification(message: str, notif_type: str = "reminder"):
    """
    Push a notification to all connected Command Center SSE clients.
    Silent failure — never blocks the scheduler.
    """
    try:
        requests.post(
            f"{CORE_URL}/notify",
            json={"type": notif_type, "message": message},
            timeout=2
        )
    except Exception:
        pass


# ─── Trigger: Startup reminders ───────────────────────────────────────────────

def check_startup_reminders():
    """
    Fired once when Core Brain boots.
    Surfaces any pending 'on_startup' reminders in the dashboard banner.
    """
    reminders = get_pending_reminders(condition="on_startup")
    if not reminders:
        return

    logger.info(f"[PROACTIVE] {len(reminders)} startup reminder(s) found")
    for r in reminders:
        logger.info(f"[PROACTIVE] ⏰ Startup: {r['content']}")
        _push_notification(r["content"], notif_type="reminder")
        if r["action"]:
            _fire_command(r["action"], source="startup_reminder")
        mark_reminder_fired(r["id"])


# ─── Trigger: Timed reminders (every 1 min) ───────────────────────────────────

def check_timed_reminders():
    """
    Checks for any reminders whose remind_at timestamp has passed.
    Runs every minute.
    """
    reminders = get_pending_reminders()  # no condition filter → time-based
    for r in reminders:
        logger.info(f"[PROACTIVE] ⏰ Timed: {r['content']}")
        _push_notification(r["content"], notif_type="reminder")
        if r["action"]:
            _fire_command(r["action"], source="timed_reminder")
        mark_reminder_fired(r["id"])


# ─── Trigger: Mood-based reminders (every 5 min) ─────────────────────────────

def check_mood_triggers():
    """
    Checks if the current mood matches any pending on_mood:<mood> reminders.
    Also nudges the user with uplifting music if they've been sad for a while.
    """
    current_mood = get_kv("current_mood")
    if not current_mood:
        return

    # Fire any stored mood-conditional reminders
    reminders = get_pending_reminders(condition=f"on_mood:{current_mood}")
    for r in reminders:
        logger.info(f"[PROACTIVE] 🎭 Mood trigger ({current_mood}): {r['content']}")
        _push_notification(r["content"], notif_type="mood")
        if r["action"]:
            _fire_command(r["action"], source="mood_trigger")
        mark_reminder_fired(r["id"])

    # Built-in: if mood is sad/depressed, suggest uplifting music
    if current_mood in ("sad", "depressed"):
        last_nudge_key = f"last_mood_nudge_{current_mood}"
        last_nudge = get_kv(last_nudge_key)
        if not last_nudge or (
            datetime.now() - datetime.fromisoformat(last_nudge) > timedelta(hours=1)
        ):
            _push_notification(
                f"You've been feeling {current_mood}. Want some uplifting music? "
                f"Say 'play something happy'.",
                notif_type="mood"
            )
            set_kv(last_nudge_key, datetime.now().isoformat())


# ─── Trigger: Pattern detection (every 10 min) ───────────────────────────────

def check_pattern_triggers():
    """
    Analyses the cross-surface summary for behavioral patterns and
    proactively surfaces suggestions without the user asking.
    """
    try:
        summary = build_cross_surface_summary()

        # Work mode: JARVIS tasks present, no recent music → suggest focus music
        has_jarvis = "JARVIS tasks" in summary
        has_music  = "Music:" in summary

        if has_jarvis and not has_music:
            last_suggestion = get_kv("last_focus_music_suggestion")
            if not last_suggestion or (
                datetime.now() - datetime.fromisoformat(last_suggestion)
                > timedelta(hours=2)
            ):
                _push_notification(
                    "You've been working for a while — want some focus music? "
                    "Try saying 'play something joyfull'.",
                    notif_type="insight"
                )
                set_kv("last_focus_music_suggestion", datetime.now().isoformat())

        # Reminder pattern: user mentioned 'remind' on any surface → nudge
        if "Pattern: User has set or mentioned a reminder" in summary:
            last_reminder_nudge = get_kv("last_reminder_nudge")
            if not last_reminder_nudge or (
                datetime.now() - datetime.fromisoformat(last_reminder_nudge)
                > timedelta(hours=4)
            ):
                _push_notification(
                    "You mentioned a reminder earlier. I've logged it — "
                    "I'll remind you when you're back.",
                    notif_type="insight"
                )
                set_kv("last_reminder_nudge", datetime.now().isoformat())

    except Exception as e:
        logger.debug(f"[PROACTIVE] Pattern trigger error (non-critical): {e}")


# ─── Load user-defined scheduled tasks from DB ────────────────────────────────

def _load_scheduled_tasks():
    """
    Reads scheduled_tasks table and registers each active cron job.
    Called once at startup — any tasks added via /schedule endpoint
    require a Core Brain restart to take effect (or call this again).
    """
    tasks = get_active_scheduled_tasks()
    if not tasks:
        logger.info("[PROACTIVE] No user-defined scheduled tasks found")
        return

    for task in tasks:
        try:
            scheduler.add_job(
                _fire_command,
                CronTrigger.from_crontab(task["cron"], timezone="Asia/Kolkata"),
                args=[task["command"], "scheduled"],
                id=f"task_{task['id']}",
                replace_existing=True,
            )
            logger.info(
                f"[PROACTIVE] Scheduled: '{task['label']}' @ {task['cron']} "
                f"→ '{task['command']}'"
            )
        except Exception as e:
            logger.error(
                f"[PROACTIVE] Failed to register task '{task['label']}': {e}"
            )


# ─── Public API ───────────────────────────────────────────────────────────────

def start_proactive_engine():
    """
    Boot the proactive engine. Call once inside FastAPI @app.on_event('startup').
    """
    logger.info("[PROACTIVE] Starting proactive engine...")

    # Built-in interval jobs
    scheduler.add_job(
        check_timed_reminders,
        "interval",
        minutes=1,
        id="timed_reminders",
        replace_existing=True,
    )
    scheduler.add_job(
        check_mood_triggers,
        "interval",
        minutes=5,
        id="mood_triggers",
        replace_existing=True,
    )
    scheduler.add_job(
        check_pattern_triggers,
        "interval",
        minutes=10,
        id="pattern_triggers",
        replace_existing=True,
    )

    # Load user-defined scheduled tasks from DB
    _load_scheduled_tasks()

    scheduler.start()
    logger.info("[PROACTIVE] Scheduler started (3 built-in + user tasks)")

    # Fire startup reminders immediately (don't wait for first interval)
    check_startup_reminders()
    logger.info("[PROACTIVE] Engine running ✅")


def stop_proactive_engine():
    """Graceful shutdown — call in FastAPI @app.on_event('shutdown')."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[PROACTIVE] Engine stopped")


def reload_scheduled_tasks():
    """
    Hot-reload user tasks without restarting Core Brain.
    Call after POST /schedule to pick up new tasks immediately.
    """
    # Remove all existing user task jobs
    for job in scheduler.get_jobs():
        if job.id.startswith("task_"):
            job.remove()
    # Re-load from DB
    _load_scheduled_tasks()
    logger.info("[PROACTIVE] Scheduled tasks reloaded")
