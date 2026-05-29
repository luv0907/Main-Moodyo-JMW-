"""
intent_router.py
────────────────
Classifies a user's natural language command into one or more intents.

PARALLEL TOOL CALLS:
  "play lofi and open notion" → [MUSIC: joyfull, JARVIS: open notion]
  Both execute simultaneously, both show in the dashboard.

RESILIENCE:
  - Hard 3-second AI timeout → instant keyword fallback
  - Never stalls, never crashes

CONTEXT AWARENESS:
  Injects the last 5 commands + current mood from context_store into the
  AI prompt, so "pause it" after "play something sad" routes correctly.
"""
import requests
import json
import logging
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'whats-app-chat-bot'))
from config import NVIDIA_API_KEY, NVIDIA_BASE_URL, MODEL
from context_store import build_context_summary, build_cross_surface_summary

logger = logging.getLogger(__name__)

# ─── System prompt — now asks for an ARRAY to support parallel intents ────────
INTENT_SYSTEM_PROMPT = """
You are an intent classifier for a personal AI assistant with 3 capabilities:

1. MUSIC  — Play/find music by mood. Valid moods: happy, sad, joyfull, depressed
   Note: If the user requests a style, genre, or mood that is not directly one of the 4 valid moods, you MUST map it to the closest valid mood. For example, "focused", "lofi", "study", "chill", or "ambient" should map to "joyfull". "upbeat" or "energetic" should map to "happy".
2. JARVIS — Control the PC (open apps, type, click) OR browse the web / perform browser tasks.
   - If the task is a browser task (e.g., navigating websites, searching Google/Amazon/YouTube, checking email in a webmail client, filling out forms, scraping web page content, or multi-step web workflows), you MUST set "browser": true in the JARVIS intent.
   - For standard desktop PC control tasks (like opening native apps, local code execution, system volume), set "browser": false.
3. WHATSAPP — Send a WhatsApp message to a contact

IMPORTANT: A command can have MULTIPLE intents (e.g. "play lofi and open notion").
Always respond with a JSON ARRAY, even if there is only one intent.

Format:
[
  {"intent": "MUSIC", "mood": "happy|sad|joyfull|depressed"},
  {"intent": "JARVIS", "command": "<exact command>", "browser": true|false},
  {"intent": "WHATSAPP", "contact": "<name>", "message": "<text>"}
]

Rules:
- Output ONLY the JSON array, nothing else.
- If uncertain, default to JARVIS.
- Never include duplicate intents.
""".strip()

# ─── Keyword fallback ─────────────────────────────────────────────────────────
MUSIC_KEYWORDS    = {"play", "music", "song", "songs", "playlist", "listen", "spotify",
                     "track", "album", "vibes", "mood", "lofi", "beats", "tune"}
WHATSAPP_KEYWORDS = {"send", "tell", "message", "whatsapp", "text", "msg", "inform",
                     "notify", "say", "let", "reply", "contact", "ping"}
MUSIC_MOODS = {
    "happy":     {"happy", "joyful", "upbeat", "cheerful", "energetic", "fun", "good"},
    "sad":       {"sad", "melancholy", "down", "blue", "cry", "gloomy", "depressing"},
    "joyfull":   {"joy", "joyfull", "joyful", "excited", "ecstatic", "thrilled", "lofi"},
    "depressed": {"depressed", "depressing", "low", "empty", "hopeless", "dark"},
}
MOOD_FUZZY = {
    "joyful": "joyfull", "low": "sad", "blue": "sad",
    "excited": "joyfull", "down": "depressed", "dark": "depressed",
    "focused": "joyfull", "lofi": "joyfull", "study": "joyfull"
}


def _keyword_fallback(command: str) -> list[dict]:
    """
    Instant, zero-latency fallback. Splits by "and"/"then" to support parallel intents.
    """
    import re
    # Split by ' and ' or ' then ' or ' & '
    parts = re.split(r'\s+(?:and|then|&)\s+', command, flags=re.IGNORECASE)
    intents = []
    seen_intents = set()

    for part in parts:
        part = part.strip()
        if not part:
            continue
            
        words = set(part.lower().split())
        part_intent = None
        
        # 1. WHATSAPP detection
        if words & WHATSAPP_KEYWORDS:
            part_intent = {"intent": "WHATSAPP", "contact": "", "message": part, "_fallback": True}
            
        # 2. MUSIC detection
        elif words & MUSIC_KEYWORDS:
            detected_mood = "happy"
            for mood, mood_words in MUSIC_MOODS.items():
                if words & mood_words:
                    detected_mood = mood
                    break
            # Fuzzy match mapping for fallback
            for fuzzy_word, target_mood in MOOD_FUZZY.items():
                if fuzzy_word in words:
                    detected_mood = target_mood
                    break
            part_intent = {"intent": "MUSIC", "mood": detected_mood, "_fallback": True}
            
        # 3. JARVIS fallback for this part
        else:
            is_browser_cmd = any(w in part.lower() for w in ("search", "google", "youtube", "amazon", "gmail", "website", "http", "www", "url", "internet", "browser", "chrome"))
            part_intent = {"intent": "JARVIS", "command": command, "browser": is_browser_cmd, "_fallback": True}
            
        if part_intent and part_intent["intent"] not in seen_intents:
            intents.append(part_intent)
            seen_intents.add(part_intent["intent"])

    # If the only intent type detected is JARVIS, or if no intents detected, return single JARVIS with full command
    if not intents or (len(intents) == 1 and intents[0]["intent"] == "JARVIS"):
        is_browser_cmd = any(w in command.lower() for w in ("search", "google", "youtube", "amazon", "gmail", "website", "http", "www", "url", "internet", "browser", "chrome"))
        return [{"intent": "JARVIS", "command": command, "browser": is_browser_cmd, "_fallback": True}]
        
    return intents


def _parse_response(raw: str) -> list[dict]:
    """Strip markdown fences and parse JSON array from the AI response."""
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    parsed = json.loads(raw)

    # Handle both array and single-object responses
    if isinstance(parsed, dict):
        return [parsed]
    if isinstance(parsed, list):
        return parsed
    raise ValueError(f"Unexpected response shape: {type(parsed)}")


def classify_intent(command: str) -> list[dict]:
    """
    Classifies a natural language command into a LIST of structured intent dicts.
    Returns multiple intents when the command spans multiple agents.

    Strategy:
      1. Build context summary from recent history
      2. Try AI (OpenRouter) with 3-second timeout
      3. On failure → keyword fallback (always returns in <1ms)

    Returns: List[dict] e.g. [{"intent": "MUSIC", "mood": "sad"}, {"intent": "JARVIS", ...}]
    """
    logger.info(f"[INTENT] Classifying: '{command}'")

    # Build cross-surface context to inject
    try:
        context_summary = build_cross_surface_summary()
    except Exception:
        try:
            context_summary = build_context_summary()
        except Exception:
            context_summary = "No prior context."

    context_block = (
        f"\nCROSS-SURFACE USER CONTEXT (last 24h):\n{context_summary}\n"
        if context_summary else ""
    )

    try:
        response = requests.post(
            NVIDIA_BASE_URL,
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": INTENT_SYSTEM_PROMPT + context_block},
                    {"role": "user", "content": command}
                ],
                "temperature": 0.1,
                "max_tokens": 500,
                "stream": False
            },
            timeout=3  # ← hard 3s cap
        )
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"].strip()
        intents = _parse_response(raw)
        logger.info(f"[INTENT] AI classified: {intents}")
        return intents

    except requests.exceptions.Timeout:
        logger.warning("[INTENT] AI timed out (>3s) — using keyword fallback")
    except requests.exceptions.ConnectionError:
        logger.warning("[INTENT] OpenRouter unreachable — using keyword fallback")
    except requests.exceptions.HTTPError as e:
        logger.warning(f"[INTENT] API HTTP error {e} — using keyword fallback")
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"[INTENT] Parse failed: {e} — using keyword fallback")
    except Exception as e:
        logger.error(f"[INTENT] Unexpected error: {e} — using keyword fallback")

    return _keyword_fallback(command)
