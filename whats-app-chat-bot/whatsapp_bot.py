import logging
import requests
from flask import Blueprint, request, jsonify
from reply_engine import generate_reply
from whatsapp_service import send_reply
from database import is_bot_enabled, save_message, upsert_profile_name

logger = logging.getLogger(__name__)
whatsapp_bp = Blueprint('whatsapp', __name__)

# The Core Brain endpoint — used for self-message routing and unified thread logging
CORE_BRAIN_URL = "http://localhost:8000/command"
CORE_LOG_URL   = "http://localhost:8000/log"

# Your own WhatsApp number (in international format e.g. "919876543210@c.us")
# When the bot receives a message FROM this number, it forwards to Core Brain
# Leave empty to disable self-routing
MY_WHATSAPP_NUMBER = "919876543210@c.us"   # e.g. "919876543210@c.us"


def _log_to_core(content: str, actor: str = "user", success: bool = None):
    """
    Fire-and-forget: write one interaction to the unified cross-surface thread.
    Never blocks — 2s timeout, silently swallowed on failure.
    This is what gives JARVIS and the Command Center visibility into WhatsApp.
    """
    try:
        requests.post(
            CORE_LOG_URL,
            json={
                "surface": "whatsapp",
                "actor":   actor,
                "content": content,
                "agent":   "WHATSAPP",
                "success": success,
            },
            timeout=2
        )
    except Exception:
        pass  # never block WhatsApp on Core Brain availability


@whatsapp_bp.route('/whatsapp', methods=['POST'])
def receive_whatsapp():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    sender  = data.get('from', '').strip()
    message = data.get('body', '').strip()
    name    = data.get('name', sender).strip()

    if not sender or not message:
        return jsonify({"error": "Missing 'from' or 'body'"}), 400

    logger.info(f"[WEBHOOK] {name} ({sender}): {message}")

    # ── Self-message routing: if the message is from YOU, treat it as a command
    if MY_WHATSAPP_NUMBER and sender == MY_WHATSAPP_NUMBER:
        logger.info(f"[SELF-CMD] Forwarding '{message}' to Core Brain.")
        # Log your own command to the unified thread
        _log_to_core(message, actor="user")
        try:
            resp = requests.post(
                CORE_BRAIN_URL,
                json={"command": message, "surface": "whatsapp"},
                timeout=20
            )
            result = resp.json()
            feedback = f"✅ Core Brain: intent={result.get('intent', {}).get('intent', '?')} | {result.get('detail', result.get('error', 'done'))}"
            _log_to_core(feedback, actor="agent", success=True)
            send_reply(sender, feedback)
        except Exception as e:
            logger.error(f"[SELF-CMD] Core Brain unreachable: {e}")
            send_reply(sender, "⚠️ Core Brain offline or error.")
        return jsonify({"status": "self_command_dispatched"}), 200

    # ALWAYS save the incoming message so it appears in the UI
    upsert_profile_name(sender, name)
    save_message(sender, "user", message)

    # Log the inbound message to the unified cross-surface thread
    _log_to_core(f"{name}: {message}", actor="user")

    # Check Killswitch
    if not is_bot_enabled():
        logger.info(f"[KILLSWITCH] Bot is OFF. Ignoring message from {name}.")
        return jsonify({"status": "ignored", "reason": "Bot is OFF"}), 200

    reply = generate_reply(sender, name, message)
    logger.info(f"[WEBHOOK] Ajju: {reply}")

    # Log the bot's reply to the unified thread
    _log_to_core(reply, actor="agent", success=True)

    send_reply(sender, reply)
    return jsonify({"status": "ok", "reply": reply}), 200


@whatsapp_bp.route('/api/send-command', methods=['POST'])
def send_whatsapp_command():
    """
    Called by Core Brain to send a WhatsApp message to a named contact.
    Looks up the contact number from the database profiles table.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    contact = data.get('contact', '').strip()
    message = data.get('message', '').strip()

    if not contact or not message:
        return jsonify({"error": "Missing contact or message"}), 400

    # Try to resolve contact name → WhatsApp number from the profiles DB
    try:
        import sqlite3, os
        db_path = os.path.join(os.path.dirname(__file__), 'messaging_bot.db')
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT sender FROM profiles WHERE LOWER(name) LIKE ? LIMIT 1",
                    (f"%{contact.lower()}%",))
        row = cur.fetchone()
        conn.close()

        if row:
            sender_number = row[0]
            send_reply(sender_number, message)
            logger.info(f"[SEND-CMD] Sent to {contact} ({sender_number}): '{message}'")
            return jsonify({"status": "sent", "to": contact, "number": sender_number})
        else:
            logger.warning(f"[SEND-CMD] Contact '{contact}' not found in profiles DB.")
            return jsonify({"error": f"Contact '{contact}' not found. They need to message the bot first."}), 404

    except Exception as e:
        logger.error(f"[SEND-CMD] Error: {e}")
        return jsonify({"error": str(e)}), 500