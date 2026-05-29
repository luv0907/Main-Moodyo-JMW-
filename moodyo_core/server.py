"""
server.py — MoodyO Core Brain v2
──────────────────────────────────
Central FastAPI router that unifies all MoodyO sub-agents.

New in v2:
  • Parallel tool dispatch — "play lofi and open notion" fires BOTH simultaneously
  • Context store — every command saved to SQLite, injected into next classification
  • /context endpoint — live view of mood + command history for the dashboard

Endpoints:
  POST /command          → Classify & dispatch (parallel if multi-intent)
  GET  /status           → Live health of all agents
  GET  /whatsapp/chats   → Recent WhatsApp conversations
  GET  /context          → Current context store (mood, history)
  POST /context/mood     → Manually set current mood
"""
from __future__ import annotations
import logging
import sys
import os
import concurrent.futures

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'whats-app-chat-bot'))

from intent_router import classify_intent
from agent_bridge import send_to_jarvis, send_to_whatsapp, route_to_moodyo, check_agent_status
from context_store import (
    init_context_db, save_command, get_recent_commands,
    get_all_context, set_context, build_context_summary, get_pattern_insight,
    log_event, get_kv, get_context_summary
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="MoodyO Core Brain", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_context_db()
    logger.info("[CORE] Context DB ready. MoodyO Core Brain v2 online.")


# ─── Models ───────────────────────────────────────────────────────────────────
class CommandRequest(BaseModel):
    command: str
    surface: str = "command_center"  # which surface sent this command


class SetMoodRequest(BaseModel):
    mood: str


class LogRequest(BaseModel):
    """Schema for the /log endpoint — lets any surface write to unified_thread."""
    surface: str
    actor: str = "user"
    content: str
    agent: str = None
    success: bool = None
    mood: str = None
    metadata: dict = None


# ─── Intent dispatcher ────────────────────────────────────────────────────────

def _dispatch_single_intent(intent: dict, raw_command: str) -> dict:
    """
    Dispatches one intent to the appropriate agent.
    Called in parallel for multi-intent commands.
    """
    intent_type = intent.get("intent", "JARVIS")

    if intent_type == "MUSIC":
        mood = intent.get("mood", "happy")
        result = route_to_moodyo(mood)
        # Persist mood to context store
        try:
            set_context("current_mood", mood)
        except Exception:
            pass

    elif intent_type == "WHATSAPP":
        contact = intent.get("contact", "")
        message = intent.get("message", "")
        if not contact or not message:
            result = {
                "success": False,
                "agent": "WHATSAPP",
                "error": "Could not extract contact or message from command",
                "detail": None
            }
        else:
            result = send_to_whatsapp(contact, message)

    else:  # JARVIS (default)
        jarvis_command = intent.get("command", raw_command)
        is_browser = intent.get("browser", False)
        result = send_to_jarvis(jarvis_command, browser=is_browser)

    result["intent"] = intent
    return result


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "MoodyO Core Brain", "version": "2.0.0", "status": "online"}


@app.post("/command")
def handle_command(body: CommandRequest):
    """
    Main entry point. Receives a natural-language command, classifies it into
    one or more intents, then dispatches ALL of them in parallel.

    Example: "play lofi and open notion"
      → [MUSIC: joyfull, JARVIS: open notion]
      → Both fire simultaneously, both results returned
    """
    command = body.command.strip()
    if not command:
        return {"success": False, "error": "Empty command", "results": []}

    logger.info(f"[CORE] Command: '{command}'")

    # Step 1: Classify (returns a list now)
    intents = classify_intent(command)
    logger.info(f"[CORE] {len(intents)} intent(s) detected: {[i.get('intent') for i in intents]}")

    # Step 2: Dispatch all intents in parallel
    results = []
    if len(intents) == 1:
        # Single intent — no thread overhead
        results.append(_dispatch_single_intent(intents[0], command))
    else:
        # Multiple intents — fire simultaneously
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(intents)) as executor:
            futures = {
                executor.submit(_dispatch_single_intent, intent, command): intent
                for intent in intents
            }
            for future in concurrent.futures.as_completed(futures):
                try:
                    results.append(future.result())
                except Exception as e:
                    intent = futures[future]
                    results.append({
                        "success": False,
                        "agent": intent.get("intent", "UNKNOWN"),
                        "error": f"Dispatch failed: {e}",
                        "intent": intent,
                        "detail": None
                    })

    # Step 3: Save to unified cross-surface thread
    all_success = all(r.get("success", False) for r in results)
    agents_used = ", ".join(set(r.get("agent", "?") for r in results))
    try:
        set_context("last_agent", agents_used)
        current_mood = get_kv("current_mood")
        for r in results:
            # Write to unified thread with surface tag from the request
            log_event(
                surface=body.surface,
                actor="user",
                content=command,
                agent=r.get("agent", "?"),
                success=r.get("success", False),
                mood=current_mood,
                metadata={"intent": r.get("intent", {}), "error": r.get("error")}
            )
    except Exception as e:
        logger.warning(f"[CORE] Context store write failed: {e}")

    # Step 4: Return — single result or list
    if len(results) == 1:
        return results[0]
    return {
        "success": all_success,
        "parallel": True,
        "count": len(results),
        "results": results,
        # Include first redirect if any (for Moodyo navigation)
        "redirect": next((r["redirect"] for r in results if r.get("redirect")), None)
    }


@app.get("/status")
def get_status():
    """Returns live health status of all agents for the dashboard."""
    return check_agent_status()


@app.get("/context")
def get_context_endpoint():
    """Returns the full context — mood, unified thread summary, history, and proactive insight."""
    try:
        insight = get_pattern_insight()
        ctx = get_context_summary()
        return {
            "context":               get_all_context(),
            "history":               get_recent_commands(10),
            "summary":               ctx["cross_surface_summary"],
            "cross_surface_summary": ctx["cross_surface_summary"],
            "recent_thread":         ctx["recent_thread"],
            "insight":               insight,
        }
    except Exception as e:
        return {"error": str(e), "context": {}, "history": [], "insight": None}


@app.post("/context/mood")
def set_mood_endpoint(body: SetMoodRequest):
    """Manually set current mood (called by Moodyo when user scans face)."""
    valid = ["happy", "sad", "joyfull", "depressed"]
    mood = body.mood.lower().strip()
    if mood not in valid:
        return {"success": False, "error": f"Invalid mood. Use: {valid}"}
    set_context("current_mood", mood)
    logger.info(f"[CORE] Mood set to: {mood}")
    return {"success": True, "mood": mood}


@app.post("/log")
def log_event_endpoint(body: LogRequest):
    """
    Universal write endpoint for the unified cross-surface thread.
    Any surface (WhatsApp bot, Moodyo Next.js, external tools) can POST here
    to record an interaction without touching the SQLite DB directly.
    """
    try:
        log_event(
            surface=body.surface,
            actor=body.actor,
            content=body.content,
            agent=body.agent,
            success=body.success,
            mood=body.mood or get_kv("current_mood"),
            metadata=body.metadata,
        )
        return {"ok": True}
    except Exception as e:
        logger.error(f"[LOG] Write failed: {e}")
        return {"ok": False, "error": str(e)}


@app.get("/context/thread")
def get_thread_endpoint(hours: int = 24, limit: int = 30):
    """Returns the raw unified thread for the last N hours (used by dashboard)."""
    try:
        from context_store import get_recent_thread
        return {"thread": get_recent_thread(hours=hours, limit=limit)}
    except Exception as e:
        return {"thread": [], "error": str(e)}


@app.get("/whatsapp/chats")
def get_whatsapp_chats(limit: int = 20):
    """
    Returns recent WhatsApp conversations by reading from Firebase.
    Falls back to SQLite if Firebase is unavailable.
    """
    try:
        import sqlite3
        db_path = os.path.join(
            os.path.dirname(__file__), '..', 'whats-app-chat-bot', 'messaging_bot.db'
        )
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT m.sender, m.role, m.content, m.timestamp,
                   COALESCE(p.name, m.sender) as display_name
            FROM messages m
            LEFT JOIN profiles p ON m.sender = p.sender
            ORDER BY m.timestamp DESC
            LIMIT ?
        """, (limit,))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return {"chats": rows}
    except Exception as e:
        logger.error(f"[CORE] Failed to read WhatsApp chats: {e}")
        return {"chats": [], "error": str(e)}
