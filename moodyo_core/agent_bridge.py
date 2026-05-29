"""
agent_bridge.py
───────────────
Connects the MoodyO Core Brain to each individual agent:

  • JARVIS     → POST http://localhost:8765/api/execute
  • WHATSAPP   → POST http://localhost:5001/api/send-command
  • MOODYO     → Returns mood routing info for the Next.js frontend

Every function returns a structured dict with:
  success: bool       — did it work?
  agent:   str        — which agent was targeted
  error:   str|None   — human-readable reason if success=False
  detail:  any|None   — agent's actual response payload if success=True
"""
import requests
import logging

logger = logging.getLogger(__name__)

JARVIS_URL   = "http://localhost:8765/api/execute"
JARVIS_STATUS_URL = "http://localhost:8765/api/status"
WHATSAPP_URL = "http://localhost:5001/api/send-command"
WHATSAPP_HEALTH_URL = "http://localhost:5001/health"

# Timeouts (seconds)
JARVIS_TIMEOUT    = 10   # JARVIS may need time to start an action
WHATSAPP_TIMEOUT  = 10
STATUS_TIMEOUT    = 2    # health checks must be fast


# ─── JARVIS Bridge ────────────────────────────────────────────────────────────

def send_to_jarvis(command: str, browser: bool = False) -> dict:
    """
    Sends a text command to the JARVIS engine via its REST API.
    JARVIS will execute it autonomously (open apps, search web, etc.)
    """
    logger.info(f"[BRIDGE → JARVIS] '{command}' (browser={browser})")
    try:
        resp = requests.post(
            JARVIS_URL,
            json={"command": command, "browser": browser},
            timeout=JARVIS_TIMEOUT
        )
        resp.raise_for_status()
        return {
            "success": True,
            "agent": "JARVIS",
            "detail": resp.json(),
            "error": None
        }
    except requests.exceptions.ConnectionError:
        msg = "JARVIS is offline — is it running on port 8765?"
        logger.error(f"[BRIDGE] {msg}")
        return {"success": False, "agent": "JARVIS", "error": msg, "detail": None}
    except requests.exceptions.Timeout:
        msg = "JARVIS timed out — it may be busy or overloaded"
        logger.error(f"[BRIDGE] {msg}")
        return {"success": False, "agent": "JARVIS", "error": msg, "detail": None}
    except requests.exceptions.HTTPError as e:
        msg = f"JARVIS returned an error: {e.response.status_code}"
        logger.error(f"[BRIDGE] {msg}")
        return {"success": False, "agent": "JARVIS", "error": msg, "detail": None}
    except Exception as e:
        msg = f"Unexpected JARVIS error: {e}"
        logger.error(f"[BRIDGE] {msg}")
        return {"success": False, "agent": "JARVIS", "error": msg, "detail": None}


# ─── WhatsApp Bridge ──────────────────────────────────────────────────────────

def send_to_whatsapp(contact: str, message: str) -> dict:
    """
    Sends a WhatsApp message to a contact via the WhatsApp Flask backend.
    The Flask backend looks up the contact in its database and dispatches.
    """
    logger.info(f"[BRIDGE → WHATSAPP] To: {contact} | Msg: '{message}'")
    try:
        resp = requests.post(
            WHATSAPP_URL,
            json={"contact": contact, "message": message},
            timeout=WHATSAPP_TIMEOUT
        )
        resp.raise_for_status()
        return {
            "success": True,
            "agent": "WHATSAPP",
            "detail": resp.json(),
            "error": None
        }
    except requests.exceptions.ConnectionError:
        msg = "WhatsApp bot is offline — is it running on port 5001?"
        logger.error(f"[BRIDGE] {msg}")
        return {"success": False, "agent": "WHATSAPP", "error": msg, "detail": None}
    except requests.exceptions.Timeout:
        msg = "WhatsApp bot timed out"
        logger.error(f"[BRIDGE] {msg}")
        return {"success": False, "agent": "WHATSAPP", "error": msg, "detail": None}
    except requests.exceptions.HTTPError as e:
        # 404 means contact not found — give a human-friendly message
        if e.response.status_code == 404:
            try:
                detail = e.response.json().get("error", "Contact not found")
            except Exception:
                detail = "Contact not found in database"
            logger.warning(f"[BRIDGE] WhatsApp 404: {detail}")
            return {"success": False, "agent": "WHATSAPP", "error": detail, "detail": None}
        msg = f"WhatsApp bot returned error {e.response.status_code}"
        logger.error(f"[BRIDGE] {msg}")
        return {"success": False, "agent": "WHATSAPP", "error": msg, "detail": None}
    except Exception as e:
        msg = f"Unexpected WhatsApp error: {e}"
        logger.error(f"[BRIDGE] {msg}")
        return {"success": False, "agent": "WHATSAPP", "error": msg, "detail": None}


# ─── Moodyo Music Bridge ──────────────────────────────────────────────────────

def route_to_moodyo(mood: str) -> dict:
    """
    Returns routing info for the Moodyo Next.js frontend.
    The frontend navigates to /<mood> and auto-plays the playlist.
    No HTTP call needed — the frontend handles navigation from the response.
    """
    valid_moods = ["happy", "sad", "joyfull", "depressed"]
    mood_clean = mood.lower().strip()

    # Fuzzy match: "joyful" → "joyfull", "low" → "sad", etc.
    if mood_clean not in valid_moods:
        mood_map = {"joyful": "joyfull", "low": "sad", "blue": "sad",
                    "excited": "joyfull", "down": "depressed", "dark": "depressed"}
        mood_clean = mood_map.get(mood_clean, "happy")

    logger.info(f"[BRIDGE → MOODYO] Mood: {mood_clean}")
    return {
        "success": True,
        "agent": "MOODYO",
        "mood": mood_clean,
        "redirect": f"/{mood_clean}",
        "error": None,
        "detail": {"playlist": mood_clean}
    }


# ─── Status Checks ────────────────────────────────────────────────────────────

def check_agent_status() -> dict:
    """
    Pings all agents and returns their live status.
    Used by the Moodyo dashboard status indicators.
    Returns consistent structured responses — never silently fails.
    """
    statuses = {}

    # JARVIS
    try:
        r = requests.get(JARVIS_STATUS_URL, timeout=STATUS_TIMEOUT)
        if r.ok:
            statuses["jarvis"] = "online"
        else:
            statuses["jarvis"] = "error"
    except requests.exceptions.ConnectionError:
        statuses["jarvis"] = "offline"
    except requests.exceptions.Timeout:
        statuses["jarvis"] = "error"
    except Exception:
        statuses["jarvis"] = "error"

    # WhatsApp Flask backend
    try:
        r = requests.get(WHATSAPP_HEALTH_URL, timeout=STATUS_TIMEOUT)
        if r.ok:
            statuses["whatsapp"] = "online"
        else:
            statuses["whatsapp"] = "error"
    except requests.exceptions.ConnectionError:
        statuses["whatsapp"] = "offline"
    except requests.exceptions.Timeout:
        statuses["whatsapp"] = "error"
    except Exception:
        statuses["whatsapp"] = "error"

    # Moodyo Core itself is always "online" if this code is running
    statuses["moodyo"] = "online"

    return statuses
