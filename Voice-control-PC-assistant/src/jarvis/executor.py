import pyautogui
import subprocess
import time
import os
import json
import platform
import webbrowser
from jarvis.utils.logger import logger
from jarvis.utils.app_names import resolve_app_name, resolve_to_url
from jarvis.config import settings
from jarvis.modules.sandbox_executor import SandboxExecutor

# Safety settings
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1


def _run_applescript(script: str) -> str:
    """Run an AppleScript and return its output."""
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"AppleScript error: {result.stderr.strip()}")
    return result.stdout.strip()


class JarvisExecutor:
    def __init__(self):
        self.sandbox = SandboxExecutor()
        self._browser = None

    @property
    def browser(self):
        if self._browser is None:
            from jarvis.browser_control import BrowserController
            self._browser = BrowserController()
        return self._browser

    def execute(self, step: dict) -> dict:
        action = step.get("action")
        params = step.get("params", {})
        logger.info(f"Executing action: {action} with params: {params}")

        try:
            # ─── App Control ──────────────────────────────────────────────
            if action == "open_app":
                app_name = params.get("app_name", "")
                if not app_name:
                    return {"status": "failed", "error": "Missing 'app_name'"}

                # ── Check if this is a web-only service (YouTube, Gmail, etc.) ──
                web_url = resolve_to_url(app_name)
                if web_url:
                    browser = resolve_app_name(settings.DEFAULT_BROWSER)
                    logger.info(f"Opening web service '{app_name}' at {web_url}")
                    subprocess.Popen(["open", "-a", browser, web_url])
                    time.sleep(1.5)

                else:
                    # ── Normal desktop app ─────────────────────────────────────
                    resolved = resolve_app_name(app_name)
                    logger.info(f"Opening app: {resolved}")
                    result = subprocess.run(
                        ["open", "-a", resolved],
                        capture_output=True, text=True
                    )
                    if result.returncode != 0:
                        # Fallback: try the original spoken name
                        subprocess.Popen(["open", "-a", app_name])
                    time.sleep(1.5)  # Give app time to open

            elif action == "close_window":
                pyautogui.hotkey("command", "w")

            elif action == "quit_app":
                app_name = params.get("app_name", "")
                resolved = resolve_app_name(app_name)
                _run_applescript(f'tell application "{resolved}" to quit')

            elif action == "switch_app":
                app_name = params.get("app_name", "")
                resolved = resolve_app_name(app_name)
                _run_applescript(f'tell application "{resolved}" to activate')
                time.sleep(0.5)

            elif action == "get_running_apps":
                script = 'tell application "System Events" to get name of every process whose background only is false'
                apps = _run_applescript(script)
                return {"status": "success", "result": apps}

            # ─── Web & Browser ─────────────────────────────────────────────
            elif action in ("open_url", "navigate_to_url"):
                url = params.get("url", "")
                if not url.startswith("http"):
                    url = "https://" + url
                browser = resolve_app_name(params.get("browser", settings.DEFAULT_BROWSER))
                subprocess.Popen(["open", "-a", browser, url])
                time.sleep(2)

            elif action == "search_web":
                from urllib.parse import quote_plus
                query    = params.get("query", "").strip()
                platform = params.get("platform", params.get("engine", "google")).lower().strip()
                encoded  = quote_plus(query)   # proper encoding: spaces→+, special chars→%XX

                PLATFORM_URLS = {
                    "google":        f"https://www.google.com/search?q={encoded}",
                    "youtube":       f"https://www.youtube.com/results?search_query={encoded}",
                    "reddit":        f"https://www.reddit.com/search/?q={encoded}",
                    "github":        f"https://github.com/search?q={encoded}",
                    "twitter":       f"https://twitter.com/search?q={encoded}",
                    "x":             f"https://twitter.com/search?q={encoded}",
                    "amazon":        f"https://www.amazon.com/s?k={encoded}",
                    "flipkart":      f"https://www.flipkart.com/search?q={encoded}",
                    "stackoverflow": f"https://stackoverflow.com/search?q={encoded}",
                    "wikipedia":     f"https://en.wikipedia.org/w/index.php?search={encoded}",
                    "bing":          f"https://www.bing.com/search?q={encoded}",
                    "duckduckgo":    f"https://duckduckgo.com/?q={encoded}",
                    "instagram":     f"https://www.instagram.com/explore/tags/{encoded}/",
                    "linkedin":      f"https://www.linkedin.com/search/results/all/?keywords={encoded}",
                    "pinterest":     f"https://www.pinterest.com/search/pins/?q={encoded}",
                    "hotstar":       f"https://www.hotstar.com/in/search?q={encoded}",
                    "netflix":       f"https://www.netflix.com/search?q={encoded}",
                }
                url = PLATFORM_URLS.get(platform, f"https://www.google.com/search?q={encoded}")
                browser = resolve_app_name(params.get("browser", settings.DEFAULT_BROWSER))
                logger.info(f"Searching '{query}' on {platform} → {url}")
                subprocess.Popen(["open", "-a", browser, url])
                time.sleep(1.5)



            elif action == "new_tab":
                pyautogui.hotkey("command", "t")
                time.sleep(0.5)

            elif action == "open_url_in_new_tab":
                url = params.get("url", "")
                if not url.startswith("http"):
                    url = "https://" + url
                pyautogui.hotkey("command", "t")
                time.sleep(0.8)
                pyautogui.hotkey("command", "l")  # focus address bar
                time.sleep(0.3)
                pyautogui.write(url, interval=0.03)
                pyautogui.press("enter")

            # ─── Keyboard & Input ──────────────────────────────────────────
            elif action == "type_text":
                text = params.get("text", "")
                app_name = params.get("app_name")
                
                if app_name:
                    resolved = resolve_app_name(app_name)
                    _run_applescript(f'tell application "{resolved}" to activate')
                    time.sleep(0.5)

                # Use clipboard for fast, unicode-safe pasting
                _set_clipboard(text)
                pyautogui.hotkey("command", "v")
                time.sleep(0.2)

            # ─── Self-Evolution / Code Execution ───────────────────────────
            elif action == "run_code":
                code = params.get("code", "")
                if not code:
                    return {"status": "failed", "error": "Missing 'code'"}
                
                result = self.sandbox.run_python(code)
                if result["status"] == "success":
                    return {"status": "success", "output": result["output"]}
                else:
                    return {"status": "failed", "error": result["error"], "output": result.get("output")}

            elif action == "screen_query":
                question = params.get("question", "What do you see on the screen?")
                # Take screenshot
                from jarvis.modules.vision import VisionModule
                vision = VisionModule()
                path = vision.take_screenshot()
                
                # Query LLM with image (Using the engine's LLM via a callback or direct access)
                # For simplicity in this architecture, we will return the path and let the engine handle the vision query
                return {"status": "success", "image_path": path, "output": f"Screenshot taken and saved to {path}"}

            elif action == "type_text_slow":
                # Keystroke by keystroke (for forms that block paste)
                text = params.get("text", "")
                pyautogui.write(text, interval=0.05)

            elif action == "key_press":
                key = params.get("key", "")
                pyautogui.press(key)

            elif action == "hotkey":
                # params: {"keys": ["command", "c"]}  OR {"keys": "command+c"}
                keys = params.get("keys", [])
                if isinstance(keys, str):
                    keys = [k.strip() for k in keys.split("+")]
                pyautogui.hotkey(*keys)
                time.sleep(0.2)

            elif action == "press_enter":
                pyautogui.press("enter")

            elif action == "press_escape":
                pyautogui.press("escape")

            elif action == "select_all":
                pyautogui.hotkey("command", "a")

            elif action == "copy":
                pyautogui.hotkey("command", "c")
                time.sleep(0.2)

            elif action == "paste":
                pyautogui.hotkey("command", "v")
                time.sleep(0.2)

            elif action == "undo":
                pyautogui.hotkey("command", "z")

            # ─── Mouse ─────────────────────────────────────────────────────
            elif action in ("click", "click_at"):
                x = params.get("x", None)
                y = params.get("y", None)
                if x is not None and y is not None:
                    pyautogui.click(int(x), int(y))
                else:
                    pyautogui.click()

            elif action == "right_click":
                x = params.get("x", None)
                y = params.get("y", None)
                if x is not None and y is not None:
                    pyautogui.rightClick(int(x), int(y))
                else:
                    pyautogui.rightClick()

            elif action == "double_click":
                x = params.get("x", None)
                y = params.get("y", None)
                if x is not None and y is not None:
                    pyautogui.doubleClick(int(x), int(y))
                else:
                    pyautogui.doubleClick()

            elif action == "move_mouse":
                x = params.get("x", 0)
                y = params.get("y", 0)
                pyautogui.moveTo(int(x), int(y), duration=0.3)

            elif action == "drag_and_drop":
                x1, y1 = int(params["x1"]), int(params["y1"])
                x2, y2 = int(params["x2"]), int(params["y2"])
                pyautogui.drag(x1, y1, x2, y2, duration=0.5, button="left")

            elif action == "scroll":
                direction = params.get("direction", "down")
                amount = int(params.get("amount", 3))
                if direction == "up":
                    pyautogui.scroll(amount)
                else:
                    pyautogui.scroll(-amount)

            # ─── Clipboard ─────────────────────────────────────────────────
            elif action == "clipboard_set":
                text = params.get("text", "")
                _set_clipboard(text)

            elif action == "clipboard_get":
                content = _get_clipboard()
                return {"status": "success", "result": content}

            # ─── Files ─────────────────────────────────────────────────────
            elif action == "create_file":
                filename = params.get("filename", "jarvis_file.txt")
                content = params.get("content", "")
                directory = params.get("directory", settings.DESKTOP_PATH)
                filepath = os.path.join(os.path.expanduser(directory), filename)
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                logger.info(f"Created file: {filepath}")

            elif action == "open_file":
                filepath = params.get("path", "")
                filepath = os.path.expanduser(filepath)
                subprocess.Popen(["open", filepath])
                time.sleep(1)

            elif action == "delete_file":
                filepath = os.path.expanduser(params.get("path", ""))
                if os.path.exists(filepath):
                    os.remove(filepath)
                else:
                    return {"status": "failed", "error": f"File not found: {filepath}"}

            # ─── Email (via macOS Mail.app AppleScript) ─────────────────────
            elif action == "send_email":
                to_addr = params.get("to", "")
                subject = params.get("subject", "")
                body = params.get("body", "")
                cc = params.get("cc", "")

                if not to_addr:
                    return {"status": "failed", "error": "Missing 'to' address"}

                cc_line = f'make new to recipient at end of cc recipients with properties {{address:"{cc}"}}' if cc else ""

                script = f'''
tell application "Mail"
    set newMsg to make new outgoing message with properties ¬
        {{subject:"{subject}", content:"{body}", visible:true}}
    tell newMsg
        make new to recipient at end of to recipients with properties ¬
            {{address:"{to_addr}"}}
        {cc_line}
    end tell
    send newMsg
    activate
end tell
'''
                _run_applescript(script)
                logger.info(f"Email sent to {to_addr}")

            elif action == "compose_email":
                """Open Mail compose window without sending (for review)"""
                to_addr = params.get("to", "")
                subject = params.get("subject", "")
                body = params.get("body", "")
                script = f'''
tell application "Mail"
    set newMsg to make new outgoing message with properties ¬
        {{subject:"{subject}", content:"{body}", visible:true}}
    tell newMsg
        make new to recipient at end of to recipients with properties ¬
            {{address:"{to_addr}"}}
    end tell
    activate
end tell
'''
                _run_applescript(script)

            # ─── System Control ────────────────────────────────────────────
            elif action == "system_volume":
                level = int(params.get("level", 50))
                level = max(0, min(100, level))
                _run_applescript(f"set volume output volume {level}")

            elif action == "mute":
                _run_applescript("set volume with output muted")

            elif action == "unmute":
                _run_applescript("set volume without output muted")

            elif action == "sleep_system":
                _run_applescript('tell application "System Events" to sleep')

            elif action == "lock_screen":
                _run_applescript('tell application "System Events" to keystroke "q" using {command down, control down}')

            elif action == "empty_trash":
                _run_applescript('tell application "Finder" to empty trash')

            elif action == "show_desktop":
                _run_applescript('tell application "System Events" to key code 103')

            # ─── Notifications ──────────────────────────────────────────────
            elif action == "notify":
                title = params.get("title", "JARVIS")
                message = params.get("message", "")
                subtitle = params.get("subtitle", "")
                script = f'display notification "{message}" with title "{title}" subtitle "{subtitle}"'
                _run_applescript(script)

            elif action == "show_dialog":
                message = params.get("message", "")
                _run_applescript(f'display dialog "{message}"')

            # ─── Screenshots & Vision ──────────────────────────────────────
            elif action == "take_screenshot":
                path = params.get("path", settings.SCREENSHOT_PATH)
                pyautogui.screenshot(path)
                return {"status": "success", "result": os.path.abspath(path)}

            # ─── AppleScript (raw) ─────────────────────────────────────────
            elif action == "run_applescript":
                script = params.get("script", "")
                result = _run_applescript(script)
                return {"status": "success", "result": result}

            # ─── Shell ─────────────────────────────────────────────────────
            elif action == "execute_shell":
                cmd = params.get("command", "")
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                output = result.stdout + result.stderr
                return {"status": "success", "result": output.strip()}

            # ─── Playwright Browser Actions ──────────────────────────────────
            elif action == "browser_navigate":
                url = params.get("url", "")
                return self.browser.navigate(url)

            elif action == "browser_click":
                selector = params.get("selector", params.get("selector_or_text", params.get("target", "")))
                return self.browser.click(selector)

            elif action == "browser_type":
                selector = params.get("selector", params.get("target", ""))
                text = params.get("text", params.get("value", ""))
                return self.browser.type_text(selector, text)

            elif action == "browser_scrape":
                content = self.browser.get_page_content()
                return {"status": "success", "result": content}

            elif action == "browser_screenshot":
                b64_image = self.browser.screenshot()
                screenshot_path = os.path.abspath(settings.SCREENSHOT_PATH)
                return {"status": "success", "result": "Screenshot captured", "image_path": screenshot_path}

            elif action == "browser_wait":
                selector = params.get("selector", params.get("target", params.get("text", "")))
                timeout = int(params.get("timeout", params.get("time", 5000)))
                return self.browser.wait_for(selector, timeout)

            elif action == "browser_find_and_click":
                description = params.get("description", "")
                return self.browser.find_and_click(description)

            elif action == "browser_press_key":
                key = params.get("key", "")
                return self.browser.press_key(key)

            # ─── Flow Control ──────────────────────────────────────────────
            elif action == "wait":
                secs = float(params.get("seconds", 1))
                time.sleep(secs)

            elif action == "speak":
                return {"status": "speak", "text": params.get("text", "")}

            elif action == "goal_complete":
                # Keep the browser session persistent across goals; do not stop it here.
                # It will be cleanly shut down when the JARVIS engine exits.
                return {"status": "completed"}

            else:
                return {"status": "failed", "error": f"Unknown action: {action}"}

            return {"status": "success"}

        except Exception as e:
            logger.error(f"Execution error in '{action}': {e}", exc_info=True)
            return {"status": "failed", "error": str(e)}


# ─── Clipboard Helpers ──────────────────────────────────────────────────────

def _set_clipboard(text: str):
    """Set macOS clipboard content using pbcopy."""
    proc = subprocess.Popen("pbcopy", stdin=subprocess.PIPE)
    proc.communicate(text.encode("utf-8"))


def _get_clipboard() -> str:
    """Get macOS clipboard content using pbpaste."""
    result = subprocess.run("pbpaste", capture_output=True, text=True)
    return result.stdout
