import pyautogui
import time
import os

# -----------------------------
# SAFETY SETTINGS
# -----------------------------
pyautogui.FAILSAFE = True       # Move mouse to corner to stop everything
pyautogui.PAUSE = 0.15          # Small pause after each action (human-like)


# -----------------------------
# KEYBOARD ACTIONS
# -----------------------------

def win_search(text: str):
    """
    Simulates a real user:
    Press Windows key → type text → press Enter
    """
    print(f"⌨️ Windows search: {text}")
    pyautogui.press("win")
    time.sleep(0.4)
    pyautogui.write(text, interval=0.05)
    time.sleep(0.2)
    pyautogui.press("enter")


def type_text(text: str):
    """
    Types text at the current cursor position
    """
    print(f"⌨️ Typing: {text}")
    pyautogui.write(text, interval=0.05)


def press_enter():
    """
    Press Enter key
    """
    pyautogui.press("enter")


def wait(seconds: float):
    """
    Wait for UI / page to load
    """
    print(f"⏳ Waiting {seconds} seconds")
    time.sleep(seconds)


# -----------------------------
# MOUSE ACTIONS (SAFE)
# -----------------------------

def safe_click(x: int, y: int):
    """
    Safely clicks on screen:
    - Prevents corner clicks
    - Moves mouse smoothly
    """
    screen_width, screen_height = pyautogui.size()

    # Clamp coordinates away from corners
    x = max(60, min(x, screen_width - 60))
    y = max(60, min(y, screen_height - 60))

    print(f"🖱️ Clicking at ({x}, {y})")
    pyautogui.moveTo(x, y, duration=0.3)
    pyautogui.click()


# -----------------------------
# SCREEN CAPTURE (FOR VISION)
# -----------------------------

def take_screenshot(path: str = "screen.png") -> str:
    """
    Takes a screenshot for vision-based actions
    """
    pyautogui.screenshot(path)
    return os.path.abspath(path)
