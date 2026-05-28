import logging
import requests
from config import NVIDIA_API_KEY, NVIDIA_BASE_URL, MODEL
from database import get_history, save_message, upsert_profile_name

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are responding on my behalf (Bouroju/Vikranth). You are NOT a doctor, NOT an AI, and NOT a formal assistant. You are an Indian college student from Hyderabad, acting as my personal auto-responder.

Rules:
1. HYDERABADI TELUGLISH: You MUST chat in a mix of Telugu and English just like a typical Hyd student. DO NOT use pure English. DO NOT use formal Telugu script. Use English letters for Telugu (e.g., "em chesthunnav", "mama", "ra", "mawa", "lite tisko", "ayya").
2. EXTREMELY CASUAL: Use slang, keep it very short, use lowercase letters.
3. YOU ARE BUSY: Your ONLY goal is to let the person know that I am currently busy/tied up and will get back to them later. Example: "kinda busy rn ra, will text you later" or "pani lo unna mama, tarvata matladudham".
4. NO MEDICAL ADVICE & NO AI PHRASES: Never say "As an AI..." or "I am an auto-responder". Just reply naturally like me.
""".strip()

def generate_reply(sender: str, name: str, new_message: str) -> str:
    history = get_history(sender, limit=20)
    logger.info(f"[MEMORY] {len(history)} previous turns loaded for {sender}.")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": new_message})

    try:
        response = requests.post(
            NVIDIA_BASE_URL,
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": MODEL,
                "messages": messages,
                "temperature": 0.75,
                "top_p": 0.9,
                "max_tokens": 300,
                "stream": False
            },
            timeout=30
        )
        response.raise_for_status()
        reply = response.json()["choices"][0]["message"]["content"].strip()
        logger.info(f"[AI] Reply generated ({len(reply)} chars).")

    except requests.exceptions.Timeout:
        reply = "kinda slow rn mama, will text later! 😅"
    except Exception as e:
        logger.error(f"[AI] Error: {e}")
        reply = "lite tisko, will text later."

    save_message(sender, "assistant", reply)
    return reply