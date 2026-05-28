import requests
import base64
import json
import re

OLLAMA_URL = "http://localhost:11434/api/generate"
VISION_MODEL = "llama3.2-vision:11b-instruct-q4_K_M"


def find_text_coordinates(image_path: str, target_text: str):
    """
    Uses vision model to find where text appears on screen.
    Returns (x, y) or None.
    """

    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()

    prompt = f"""
You can see a screenshot of a computer screen.

TASK:
- Find the text: "{target_text}"
- Return the CENTER coordinates of where this text appears

RULES:
- Respond ONLY with JSON
- No explanations
- If text not found, respond with null
Find text that is PHONETICALLY SIMILAR to "{target_text}"
JSON FORMAT:
{{ "x": 123, "y": 456 }}
OR
null
"""

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": VISION_MODEL,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False
        },
        timeout=180
    )

    data = response.json()

    content = None
    if "response" in data:
        content = data["response"]
    elif "message" in data and "content" in data["message"]:
        content = data["message"]["content"]

    if not content:
        return None

    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        return None

    coords = json.loads(match.group())
    return coords.get("x"), coords.get("y")
