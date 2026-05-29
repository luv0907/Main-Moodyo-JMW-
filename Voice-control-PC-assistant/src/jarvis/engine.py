from jarvis.config import settings
from jarvis.utils.logger import logger
from jarvis.modules.stt.whisper_stt import WhisperSTT
from jarvis.modules.tts.macos_tts import MacOSTTS
from jarvis.modules.tts.pyttsx3_tts import Pyttsx3TTS
from jarvis.modules.memory.semantic_memory import SemanticMemory
from jarvis.providers.llm.openrouter_provider import OpenRouterProvider
from jarvis.modules.base import BaseSTT, BaseTTS, BaseMemory, BaseLLMProvider
from jarvis.modules.vision import VisionModule
from jarvis.executor import JarvisExecutor
from jarvis.utils import contacts as contact_book
import pyautogui
import time
import os
import json
import random
import requests as _http
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import tempfile
import whisper

# ── Cross-Surface Context Helper ─────────────────────────────────────────────

CORE_BRAIN_CONTEXT_URL = "http://localhost:8000/context"
CORE_BRAIN_LOG_URL     = "http://localhost:8000/log"

def _get_cross_surface_context() -> str:
    """
    Fetches the last 24h unified thread summary from Core Brain.
    Called at the start of every ReAct loop so JARVIS knows what happened
    on WhatsApp, Moodyo, and the Command Center before it starts planning.
    Fails silently with a 1s timeout so it never blocks the voice loop.
    """
    try:
        r = _http.get(CORE_BRAIN_CONTEXT_URL, timeout=1)
        if r.ok:
            return r.json().get("cross_surface_summary", "")
    except Exception:
        pass
    return ""


def _log_goal_to_core(goal: str, success: bool):
    """
    After JARVIS completes (or fails) a goal, write it to the unified thread
    so WhatsApp and Command Center can see what JARVIS did.
    """
    try:
        _http.post(
            CORE_BRAIN_LOG_URL,
            json={
                "surface": "voice",
                "actor":   "agent",
                "content": goal,
                "agent":   "JARVIS",
                "success": success,
            },
            timeout=1
        )
    except Exception:
        pass


# ── UI Bridge (optional - only active when run_with_ui.py is used) ───────────
_ui_emit = None   # set by run_with_ui.py before starting the engine

def set_ui_emit(fn):
    """Register the bridge emit function so the engine can broadcast events."""
    global _ui_emit
    _ui_emit = fn

# ── Action catalog (concise, for llama3.2) ───────────────────────────────────
ACTION_LIST = (
    "open_app(app_name), open_url(url), "
    "search_web(query, platform='google'), "
    "  # platform options: 'youtube','google','reddit','github','twitter','amazon','flipkart','stackoverflow','wikipedia'"
    "new_tab(), "
    "switch_app(app_name), close_window(), quit_app(app_name), "
    "type_text(text), key_press(key), hotkey(keys=[key1,key2]), "
    "press_enter(), press_escape(), select_all(), copy(), paste(), "
    "click(x,y), double_click(x,y), scroll(direction,amount), move_mouse(x,y), "
    "clipboard_set(text), create_file(filename,content), open_file(path), "
    "send_email(to,subject,body), compose_email(to,subject,body), "
    "add_contact(name,email), list_contacts(), "
    "system_volume(level), mute(), unmute(), sleep_system(), lock_screen(), "
    "notify(title,message), run_applescript(script), execute_shell(command), "
    "wait(seconds), speak(text), answer(text), goal_complete()"
)

# Actions that complete the goal by themselves (no further LLM step needed)
# NOTE: open_app and switch_app are NOT here - the LLM may need to follow
# them with type_text, click, scroll, etc. for multi-step goals.
TERMINAL_ACTIONS = {
    "search_web", "open_url", "open_url_in_new_tab", "navigate_to_url",
    "close_window", "quit_app",
    "system_volume", "mute", "unmute",
    "sleep_system", "lock_screen", "empty_trash", "show_desktop",
    "notify", "show_dialog",
    "compose_email", "send_email",
    "create_file", "delete_file",
    "execute_shell", "run_applescript",
    "add_contact",
}

# Actions that require user confirmation before executing
RISKY_ACTIONS = {"send_email", "delete_file", "sleep_system", "lock_screen", "empty_trash"}

# Pure Q&A / conversation mode (no system action required)
QA_ACTIONS = {"answer", "speak"}


class JarvisEngine:
    def __init__(self):
        self.stt: BaseSTT = WhisperSTT()
        self.tts: BaseTTS = MacOSTTS() if settings.TTS_USE_MACOS else Pyttsx3TTS()
        self.memory: BaseMemory = SemanticMemory()
        self.llm: BaseLLMProvider = OpenRouterProvider()
        self.vision = VisionModule()
        self.executor = JarvisExecutor()
        self.is_running = False
        self.session_history = []   # Feature 7: in-session memory
        self._start_time = time.time()

        # Whisper base model for fast wake-word detection
        self._wake_model = None

    # ── UI Event Emitter ──────────────────────────────────────────────────────

    def _emit(self, event_type: str, **kwargs) -> None:
        """Broadcast an event to the browser UI (no-op if UI not active)."""
        if _ui_emit is not None:
            try:
                _ui_emit(event_type, kwargs)
            except Exception as exc:
                logger.debug(f"UI emit error: {exc}")

    def _emit_stats(self):
        """Broadcast current system stats to the UI."""
        self._emit("stats_update", 
            actions=len(self.session_history),
            memories=len(self.memory.get_recent(100)),
            uptime=f"{int((time.time() - self._start_time) / 60)}m"
        )

    def initialize(self):
        logger.info("Initializing Jarvis Engine...")
        self.stt.initialize()
        self.tts.initialize()
        self.memory.initialize()
        self.llm.initialize()

        if settings.WAKE_WORD_ENABLED:
            logger.info("Loading wake-word detection model (whisper tiny)...")
            self._wake_model = whisper.load_model("tiny")

        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.1
        logger.info("Jarvis Engine initialized.")

    # ── Main Loop ─────────────────────────────────────────────────────────────

    def run(self):
        self.is_running = True
        startup_msg = (
            f"Hey {settings.USER_NAME}! I'm online. Just say 'Hey JARVIS' whenever you need me."
            if settings.WAKE_WORD_ENABLED
            else f"Hey {settings.USER_NAME}, I'm online and ready. What can I do for you?"
        )
        self._emit("status", state="online", label="READY")
        self._emit("jarvis_message", text=startup_msg)
        self.tts.speak(startup_msg)

        # Seed the UI with current memory count
        try:
            mem_entries = self.memory.get_all() if hasattr(self.memory, 'get_all') else []
            self._emit("memory_update", count=len(mem_entries))
        except Exception:
            pass

        try:
            if settings.WAKE_WORD_ENABLED:
                self._wake_word_loop()
            else:
                self._push_to_talk_loop()
        finally:
            logger.info("Cleaning up engine and browser resources...")
            if hasattr(self, "executor") and self.executor._browser is not None:
                logger.info("Stopping persistent browser session...")
                from jarvis.browser_control import run_async
                try:
                    run_async(self.executor._browser.stop())
                except Exception as e:
                    logger.error(f"Error stopping browser during shutdown: {e}")

    def _wake_word_loop(self):
        """Hands-free loop: listen for wake word, then process command."""
        CHUNK_SECS = 2       # length of each wake-word probe
        SAMPLERATE  = 16000

        logger.info("Wake-word loop started. Listening for 'Jarvis'...")
        while self.is_running:
            try:
                # Check for browser-sent typed command first (non-blocking, UI mode only)
                if _ui_emit is not None:
                    try:
                        from interface.server import get_browser_command
                        browser_cmd = get_browser_command(timeout=0.05)
                        if browser_cmd:
                            self._process_request(browser_cmd)
                            continue
                    except Exception:
                        pass

                # Record a short clip
                audio = sd.rec(
                    int(CHUNK_SECS * SAMPLERATE),
                    samplerate=SAMPLERATE,
                    channels=1,
                    dtype="float32"
                )
                sd.wait()

                # Quick Whisper tiny transcription
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                    wav.write(f.name, SAMPLERATE, (audio * 32767).astype(np.int16))
                    tmp = f.name
                result = self._wake_model.transcribe(tmp, fp16=False)
                os.remove(tmp)

                heard = result["text"].strip().lower()
                if any(w in heard for w in settings.WAKE_WORDS):
                    logger.info(f"Wake word detected: '{heard}'")
                    self.tts.speak(f"Yes, {settings.USER_NAME}?")
                    self._handle_command()

            except KeyboardInterrupt:
                logger.info("Shutdown requested.")
                self.is_running = False
            except Exception as e:
                logger.exception("Wake-word loop error")

    def _push_to_talk_loop(self):
        """Fallback: press SPACE to talk. Also polls for browser typed commands."""
        while self.is_running:
            try:
                # Check for browser-sent typed command first (non-blocking, UI mode only)
                if _ui_emit is not None:
                    try:
                        from interface.server import get_browser_command
                        browser_cmd = get_browser_command(timeout=0.05)
                        if browser_cmd:
                            self._process_request(browser_cmd)
                            continue
                    except Exception:
                        pass

                self._emit("status", state="idle", label="AWAITING INPUT")
                user_input = self.stt.listen()
                if not user_input or len(user_input) < 2:
                    continue
                if self._is_stop_command(user_input):
                    bye_msg = f"Alright, shutting down. Take care, {settings.USER_NAME}!"
                    self._emit("status", state="offline", label="OFFLINE")
                    self._emit("jarvis_message", text=bye_msg)
                    self.tts.speak(bye_msg)
                    self.is_running = False
                    break
                self._process_request(user_input)
            except KeyboardInterrupt:
                logger.info("Shutdown requested.")
                self.is_running = False
            except Exception:
                logger.exception("Error in push-to-talk loop")
                self.tts.speak("Hmm, something went wrong on my end. Could you try again?")

    def _handle_command(self):
        """
        After wake word: listen for command, process it, then automatically
        listen for follow-up commands (continuous conversation) until the
        user dismisses with 'no / nothing / that's all' or gives no input.
        """
        FOLLOW_UP_PROMPTS = ["no", "nope", "nothing", "that's all", "thats all",
                             "i'm good", "im good", "never mind", "nevermind",
                             "not now", "stop listening", "go back"]
        MAX_FOLLOW_UPS = 5   # max consecutive commands per session

        try:
            # ── First command ──────────────────────────────────────────────
            self._emit("status", state="listening", label="LISTENING")
            user_input = self.stt.listen()

            if not user_input or len(user_input) < 2:
                self._emit("status", state="online", label="READY")
                self.tts.speak("I didn't catch that. Just say 'Hey JARVIS' again!")
                return

            if self._is_stop_command(user_input):
                bye_msg = f"Alright, shutting down. Take care, {settings.USER_NAME}!"
                self._emit("status", state="offline", label="OFFLINE")
                self._emit("jarvis_message", text=bye_msg)
                self.tts.speak(bye_msg)
                self.is_running = False
                return

            self._process_request(user_input)

            # ── Continuous follow-up loop ──────────────────────────────────
            for _ in range(MAX_FOLLOW_UPS):
                if not self.is_running:
                    break

                followup_msg = f"Anything else, {settings.USER_NAME}?"
                self._emit("status", state="listening", label="LISTENING")
                self._emit("jarvis_message", text=followup_msg)
                self.tts.speak(followup_msg)

                follow_input = self.stt.listen()

                # Empty / nothing said → return to wake word loop
                if not follow_input or len(follow_input) < 2:
                    done_msg = "Alright, I'll be listening for 'Hey JARVIS'!"
                    self._emit("status", state="online", label="READY")
                    self._emit("jarvis_message", text=done_msg)
                    self.tts.speak(done_msg)
                    return

                # User says no / that's all → exit conversation
                if any(p in follow_input.lower() for p in FOLLOW_UP_PROMPTS):
                    done_msg = f"Got it! Just say 'Hey JARVIS' whenever you need me."
                    self._emit("status", state="online", label="READY")
                    self._emit("jarvis_message", text=done_msg)
                    self.tts.speak(done_msg)
                    return

                # Stop command
                if self._is_stop_command(follow_input):
                    bye_msg = f"Alright, shutting down. Take care, {settings.USER_NAME}!"
                    self._emit("status", state="offline", label="OFFLINE")
                    self._emit("jarvis_message", text=bye_msg)
                    self.tts.speak(bye_msg)
                    self.is_running = False
                    return

                # Process the follow-up command
                self._process_request(follow_input)

            # Reached MAX_FOLLOW_UPS → gracefully return to wake word loop
            self._emit("status", state="online", label="READY")

        except Exception:
            logger.exception("Error handling command")
            self.tts.speak("Something went wrong. Try again!")
            self._emit("status", state="online", label="READY")


    def _is_stop_command(self, text: str) -> bool:
        stop_words = ["exit", "shutdown", "goodbye", "quit jarvis", "stop jarvis", "bye jarvis"]
        return any(w in text.lower() for w in stop_words)

    # ── Request Processor ─────────────────────────────────────────────────────

    def _process_request(self, user_input: str | dict):
        """Route between goal execution and pure conversation."""
        is_browser = False
        if isinstance(user_input, dict):
            is_browser = user_input.get("browser", False)
            user_input = user_input.get("command", "")

        # Emit user message to UI
        self._emit("user_message", text=user_input)

        # Store in session history (Feature 7)
        self.session_history.append({"role": "user", "text": user_input})
        self.memory.store(f"User said: {user_input}")

        # Check for contacts management voice commands
        if self._handle_contact_commands(user_input):
            return

        # Process as a goal
        self.process_goal(user_input, is_browser=is_browser)

    def _handle_contact_commands(self, text: str) -> bool:
        """Handle contact book voice commands before sending to LLM."""
        t = text.lower()

        # "Add [name] to contacts with email [email]"
        if "add" in t and "contact" in t:
            # Let LLM handle this via add_contact action
            return False

        # "What are my contacts?" / "Show contacts"
        if "contacts" in t and any(w in t for w in ["show", "list", "what", "who"]):
            all_contacts = contact_book.list_contacts()
            if all_contacts:
                names = ", ".join(v.get("name", k) for k, v in all_contacts.items()
                                  if isinstance(v, dict))
                self.tts.speak(f"You have {len(all_contacts)} contacts: {names}.")
            else:
                self.tts.speak("You don't have any contacts saved yet. You can say 'Add Akshay to contacts with email akshay@gmail.com'.")
            return True

        return False

    def _verify_with_vision(self, screenshot_b64: str, action_taken: str) -> str:
        """Send screenshot to vision LLM and get observation."""
        import requests
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "google/gemini-2.5-flash",
            "max_tokens": 200,
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{screenshot_b64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": f"I just performed: '{action_taken}'. Did it succeed? What do you see on screen? Be brief and specific."
                    }
                ]
            }]
        }
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=15
            )
            if response.ok:
                data = response.json()
                return data["choices"][0]["message"]["content"]
            else:
                logger.error(f"Vision verification failed with status {response.status_code}: {response.text}")
                return "Action performed (could not verify via vision)."
        except Exception as e:
            logger.error(f"Error in vision verification: {e}")
            return "Action performed (vision verification error)."

    # ── Goal Execution (ReAct loop) ───────────────────────────────────────────

    def process_goal(self, goal: str, is_browser: bool = False):
        """ReAct agent with rule-based completion, confirmation, multi-turn, and Q&A."""
        if not is_browser:
            is_browser = any(w in goal.lower() for w in ("search", "google", "youtube", "amazon", "gmail", "website", "http", "www", "url", "internet", "browser", "chrome"))
        logger.info(f"New Goal: {goal} (is_browser={is_browser})")
        self.memory.store(f"User Goal: {goal}")
        self._emit("goal_start", goal=goal)
        self._emit("status", state="thinking", label="THINKING")

        # Log the incoming goal to unified thread immediately
        _log_goal_to_core(f"Goal started: {goal}", success=None)

        executed   = []
        failed     = []
        MAX_STEPS  = 12

        last_image = None

        for step_num in range(MAX_STEPS):
            time.sleep(1.0)  # Rate limit safety
            self._emit("react_step", phase="observe", step=step_num)
            prompt = self._build_prompt(goal, executed, failed, is_browser=is_browser)

            self._emit("react_step", phase="think", step=step_num)
            # If the previous step took a screenshot, pass it to the LLM
            response = self.llm.query(prompt, image_path=last_image)
            last_image = None # Reset after use

            if "error" in response:
                err_msg = "I'm having trouble thinking right now. Mind trying again?"
                self._emit("jarvis_message", text=err_msg)
                self._emit("status", state="online", label="SYSTEM READY")
                self.tts.speak(err_msg)
                return

            response_text = response.get("response", "{}")
            logger.info(f"Step {step_num + 1} LLM: {response_text}")

            step = self._parse_single_action(response_text)
            if not step:
                # If LLM returned text but no JSON, treat as a conversational answer
                if len(response_text) > 10 and "{" not in response_text:
                    self._emit("jarvis_message", text=response_text)
                    self._emit("status", state="online", label="SYSTEM READY")
                    self.tts.speak(response_text)
                    return
                
                if executed:
                    done_msg = "I think that's sorted! Anything else?"
                else:
                    done_msg = "Hmm, I'm not quite sure how to help with that. Could you rephrase?"
                
                self._emit("jarvis_message", text=done_msg)
                self._emit("status", state="online", label="SYSTEM READY")
                self.tts.speak(done_msg)
                return

            action = step.get("action", "")
            params = step.get("params", {})
            params_key = str(sorted(params.items()))

            # ── LLM says goal is done ────────────────────────────────────────
            if action == "goal_complete":
                done_msg = "All done! Anything else I can help with?"
                self._emit("jarvis_message", text=done_msg)
                self._emit("status", state="online", label="READY")
                self.tts.speak(done_msg)
                self.memory.store(f"Goal completed: {goal}")
                _log_goal_to_core(f"Goal completed: {goal}", success=True)
                return

            # ── Deduplication guard ──────────────────────────────────────────
            repeat_count = 0
            for hist in reversed(executed):
                if hist.get("action") == action and hist.get("params_key") == params_key:
                    repeat_count += 1
                else:
                    break
            
            # For browser actions, we allow up to 2 consecutive executions of the same action/params 
            # (e.g. key clicks that might need retry) but stop if it repeats 3 or more times.
            max_repeats = 2 if action.startswith("browser_") else 1
            if repeat_count >= max_repeats:
                dup_msg = "All done! Let me know if you need anything else."
                self._emit("jarvis_message", text=dup_msg)
                self._emit("status", state="online", label="READY")
                self.tts.speak(dup_msg)
                self.memory.store(f"Goal completed: {goal}")
                return

            # ── Feature 6: Q&A / Small-talk ────────────────────────────────
            if action in QA_ACTIONS:
                answer_text = params.get("text", "")
                if answer_text:
                    self._emit("jarvis_message", text=answer_text)
                    self._emit("status", state="online", label="READY")
                    self.tts.speak(answer_text)
                    self.session_history.append({"role": "jarvis", "text": answer_text})
                    return
                continue

            # ── Feature 5: Multi-turn - fill missing params ──────────────────
            if action in ("compose_email", "send_email"):
                params = self._fill_email_params(params)
                if params is None:
                    self._emit("status", state="online", label="READY")
                    return  # user cancelled
                step["params"] = params
                params_key = str(sorted(params.items()))

            if action == "add_contact":
                params = self._fill_contact_params(params)
                step["params"] = params
                params_key = str(sorted(params.items()))

            # ── Feature 3: Confirmation for risky actions ───────────────────
            if settings.CONFIRM_RISKY_ACTIONS and action in RISKY_ACTIONS:
                if not self._confirm(action, params):
                    cancel_msg = "No worries, I've cancelled that."
                    self._emit("jarvis_message", text=cancel_msg)
                    self._emit("status", state="online", label="READY")
                    self.tts.speak(cancel_msg)
                    return

            # ── Narrate & Execute ────────────────────────────────────────────
            self._emit("react_step", phase="act", step=step_num, action=action, params=params)
            self._emit("status", state="acting", label="ACTING")

            narration = self._narrate(action, params)
            if narration:
                self._emit("jarvis_message", text=narration)
                self.tts.speak(narration)

            result = self.executor.execute(step)
            
            # Capture screenshot path for next turn if present
            if "image_path" in result:
                last_image = result["image_path"]

            if result.get("status") in ("success", "completed"):
                # Store the actual output (e.g., from run_code) in history
                result_desc = result.get("output", "success")
                
                # Check for browser vision feedback
                if action.startswith("browser_") and action not in ("browser_screenshot", "browser_scrape", "browser_wait"):
                    logger.info(f"Performing visual check for browser action: {action}")
                    try:
                        # Capture screenshot base64 directly
                        screenshot_b64 = self.executor.browser.screenshot()
                        if screenshot_b64:
                            action_desc = f"{action} with params {params}"
                            verify_text = self._verify_with_vision(screenshot_b64, action_desc)
                        else:
                            verify_text = "Action performed (could not capture screenshot)"
                        logger.info(f"Visual feedback: {verify_text}")
                        result_desc = f"Success. Visual Observation: {verify_text}"
                    except Exception as ve:
                        logger.error(f"Visual verification check failed: {ve}")
                        result_desc = "Success (visual verification failed)"

                executed.append({
                    "action": action, 
                    "params": params,
                    "params_key": params_key, 
                    "result": result_desc
                })
                self._emit("log_entry", action=action, params=params, status="ok")
                self.memory.store(f"Executed: {action}")
                self.session_history.append({"role": "jarvis", "action": action})

                if action in TERMINAL_ACTIONS:
                    completion = self._complete_message(action, params)
                    self._emit("jarvis_message", text=completion)
                    self._emit("status", state="online", label="READY")
                    self.tts.speak(completion)
                    self.memory.store(f"Goal completed: {goal}")
                    # Update memory count in UI
                    self._emit("memory_update", count=len(self.session_history))
                    return

            elif result["status"] == "speak":
                speak_text = result["text"]
                self._emit("jarvis_message", text=speak_text)
                self.tts.speak(speak_text)
                executed.append({
                    "action": action, 
                    "params": params,
                    "params_key": params_key, 
                    "result": "ok"
                })
                self._emit("log_entry", action=action, params=params, status="ok")

            else:
                err = result.get("error", "unknown error")
                logger.error(f"Action '{action}' failed: {err}")
                failed.append(action)
                executed.append({
                    "action": action, 
                    "params": params,
                    "params_key": params_key, 
                    "result": f"FAILED: {err}"
                })
                self._emit("log_entry", action=action, params=params, status="err", error=err)
                retry_msg = "That didn't quite work. Let me try a different way."
                self._emit("jarvis_message", text=retry_msg)
                self.tts.speak(retry_msg)

        final_msg = "I've done what I could! Let me know if you need anything else."
        self._emit("jarvis_message", text=final_msg)
        self._emit("status", state="online", label="SYSTEM READY")
        self.tts.speak(final_msg)
        self._emit_stats()

    # ── Feature 3: Confirmation ───────────────────────────────────────────────

    def _confirm(self, action: str, params: dict) -> bool:
        """Ask user to confirm a risky action. Returns True if confirmed."""
        confirmations = {
            "send_email":   f"I'm about to send an email to {params.get('to', 'that address')}. Shall I go ahead?",
            "delete_file":  f"I'm about to delete {params.get('path', 'that file')}. Are you sure?",
            "sleep_system": "I'm about to put your Mac to sleep. Shall I?",
            "lock_screen":  "I'm about to lock your screen. Go ahead?",
            "empty_trash":  "I'm about to empty the Trash. This can't be undone. Are you sure?",
        }
        message = confirmations.get(action, f"I'm about to {action}. Shall I go ahead?")
        self.tts.speak(message + " Say yes to confirm.")

        # Listen for yes/no
        try:
            response = self.stt.listen()
            if response and any(w in response.lower() for w in ["yes", "yeah", "sure", "ok", "do it", "go ahead", "confirm", "yep"]):
                return True
        except Exception:
            pass
        return False

    # ── Feature 5: Multi-turn helpers ─────────────────────────────────────────

    def _fill_email_params(self, params: dict) -> dict | None:
        """Ask for any missing email fields through voice."""
        # Resolve contact name to email
        to_addr = params.get("to", "").strip()
        if to_addr:
            # Try to resolve as a contact name
            resolved = contact_book.resolve_email(to_addr.lower())
            if resolved != to_addr:
                self.tts.speak(f"Sending to {to_addr} at {resolved}.")
                params["to"] = resolved
        else:
            self.tts.speak("Who should I send the email to?")
            try:
                to_raw = self.stt.listen()
                if not to_raw:
                    self.tts.speak("Okay, I'll skip that.")
                    return None
                params["to"] = contact_book.resolve_email(to_raw.strip().lower()) or to_raw
            except Exception:
                return None

        if not params.get("subject", "").strip():
            self.tts.speak("What's the subject?")
            try:
                params["subject"] = self.stt.listen() or ""
            except Exception:
                params["subject"] = ""

        if not params.get("body", "").strip():
            self.tts.speak("What should the email say?")
            try:
                params["body"] = self.stt.listen() or ""
            except Exception:
                params["body"] = ""

        return params

    def _fill_contact_params(self, params: dict) -> dict:
        """Ask for missing contact name/email."""
        if not params.get("name", "").strip():
            self.tts.speak("What's the contact's name?")
            try:
                params["name"] = self.stt.listen() or ""
            except Exception:
                params["name"] = ""

        if not params.get("email", "").strip():
            self.tts.speak(f"What's {params.get('name', 'their')} email address?")
            try:
                params["email"] = self.stt.listen() or ""
            except Exception:
                params["email"] = ""

        # Also save it immediately via contacts module
        if params.get("name") and params.get("email"):
            contact_book.add_contact(params["name"], params["email"])

        return params

    # ── LLM Prompt ────────────────────────────────────────────────────────
    def _build_prompt(self, goal: str, executed: list, failed: list, is_browser: bool = False) -> str:
        """Construct the ReAct system prompt with cross-surface context, Vision, and Browser MCP actions."""
        history_str = ""
        if executed:
            history_str += "\nHISTORY OF ACTIONS COMPLETED IN THIS GOAL:\n"
            for idx, step_info in enumerate(executed):
                history_str += f"- Step {idx + 1}: Executed action `{step_info.get('action')}` with params {step_info.get('params')} -> Observation/Result: {step_info.get('result')}\n"

        # Fetch unified cross-surface context (1s timeout, fails silently)
        cross_surface = _get_cross_surface_context()
        context_block = (
            f"\nUSER CONTEXT (last 24h across all surfaces):\n{cross_surface}\n"
            if cross_surface else ""
        )

        if is_browser:
            return f"""You are JARVIS, an autonomous PC assistant running in BROWSER CONTROL MODE.
Your task is to control the web browser using Playwright to achieve the user's goal.
{context_block}
GOAL: {goal}
{history_str}
AVAILABLE BROWSER ACTIONS:
- {{"action": "browser_navigate", "params": {{"url": "https://youtube.com"}}}} [Navigate browser to a URL]
- {{"action": "browser_click", "params": {{"selector": "button#search-icon-legacy"}}}} [Click on an element. Can be a CSS selector or text selector like 'text=Sign In']
- {{"action": "browser_type", "params": {{"selector": "input[name='search_query']", "text": "lofi music"}}}} [Type text into input field specified by selector]
- {{"action": "browser_scrape", "params": {{}}}} [Retrieve the visible text content of the current webpage]
- {{"action": "browser_screenshot", "params": {{}}}} [Capture viewport screenshot of the current page]
- {{"action": "browser_wait", "params": {{"selector": "div#content", "timeout": 5000}}}} [Wait for CSS selector to appear in DOM]
- {{"action": "browser_find_and_click", "params": {{"description": "The search button next to input field"}}}} [Use vision to find element by description and click it]
- {{"action": "browser_press_key", "params": {{"key": "Enter"}}}} [Press a keyboard key on the active element, e.g., 'Enter', 'ArrowDown', 'ArrowUp', 'Tab']
- {{"action": "answer", "params": {{"text": "final explanation"}}}} [Provide final answer when goal is achieved]
- {{"action": "goal_complete", "params": {{}}}} [Use when the browser task is successfully finished]

RULES:
1. Chain your browser actions logically: navigate -> wait for selector -> type/click -> check page content/screenshot -> repeat.
2. After every action, the system will automatically perform a vision feedback check (screenshot + LLM description) and feed it as the next step's Observation/Result. Use this feedback to verify if the action worked or if you need to retry or choose another selector.
3. If an action fails or does not do what you expected, try a different selector or use 'browser_find_and_click' with a clear description of the element.
4. Output ONLY the JSON action, nothing else.

Next action JSON:"""
        else:
            return f"""You are JARVIS, an autonomous PC assistant.
{context_block}
GOAL: {goal}
{history_str}
AVAILABLE ACTIONS:
- {{"action": "open_app", "params": {{"app_name": "Google Chrome"}}}}
- {{"action": "navigate_to_url", "params": {{"url": "youtube.com"}}}} [Open a URL in the default browser]
- {{"action": "search_web", "params": {{"query": "ipl score", "platform": "google"}}}} [Search Google or YouTube]
- {{"action": "type_text", "params": {{"text": "Hello", "app_name": "TextEdit"}}}} [Type text at current cursor]
- {{"action": "click_at", "params": {{"x": 500, "y": 400}}}} [Click at screen coordinates]
- {{"action": "run_code", "params": {{"code": "print(50*12)"}}}}
- {{"action": "screen_query", "params": {{"question": "Is the browser open?"}}}} [Capture and analyze screen]
- {{"action": "answer", "params": {{"text": "final result"}}}} [Use only when goal is finished]
- {{"action": "goal_complete", "params": {{}}}} [Use when the task is successfully finished]

VISION RULES:
1. Use "screen_query" if you need to VERIFY if an action worked (e.g., did the app actually open?).
2. Use it if the user asks "What is on my screen?".
3. The next step after screen_query will have the visual context in your brain.

RULES:
- Always complete ALL steps of a request, not just the first one. For example, for "open chrome and go to youtube":
  Step 1: {{"action": "open_app", "params": {{"app_name": "Google Chrome"}}}}
  Step 2: {{"action": "navigate_to_url", "params": {{"url": "youtube.com"}}}}
- Do not repeat the same action if it was already executed successfully.

Next action JSON:"""

    # ── Narration & Completion Messages ───────────────────────────────────────

    def _narrate(self, action: str, params: dict) -> str:
        """Return a natural-language narration of the action about to happen."""
        app      = params.get("app_name", "that")
        query    = params.get("query", "")
        platform = params.get("platform", "google").title()
        url      = params.get("url", "")
        level    = params.get("level", "")
        filename = params.get("filename", "")
        to       = params.get("to", "someone")
        key      = params.get("key", "")
        direction= params.get("direction", "down")
        text     = params.get("text", "")
        cmd      = params.get("command", "")
        name     = params.get("name", "that contact")

        # Build hostname for open_url narration
        try:
            from urllib.parse import urlparse
            host = urlparse(url).netloc.lstrip("www.") if url else url
        except Exception:
            host = url

        narrations = {
            "open_app":      f"Sure, let me open {app} for you!",
            "search_web":    f"Searching {platform} for '{query}'." if query else f"Searching {platform}.",
            "open_url":      f"Opening {host} for you." if host else "Opening that link for you.",
            "navigate_to_url": f"Opening {host} for you." if host else "Opening that link for you.",
            "click_at":      f"Clicking at ({params.get('x', '?')}, {params.get('y', '?')}).",
            "switch_app":    f"Switching over to {app}.",
            "close_window":  "Closing this window.",
            "quit_app":      f"Quitting {app}.",
            "type_text":     f"Typing: {text[:40]}{'…' if len(text) > 40 else ''}." if text else "Typing that out.",
            "key_press":     f"Pressing the {key} key.",
            "hotkey":        f"Hitting the {'+'.join(params.get('keys', [])) if isinstance(params.get('keys'), list) else params.get('keys', '')} shortcut.",
            "press_enter":   "Pressing Enter.",
            "press_escape":  "Pressing Escape.",
            "select_all":    "Selecting everything.",
            "copy":          "Copying that to clipboard.",
            "paste":         "Pasting from clipboard.",
            "click":         f"Clicking at ({params.get('x', '?')}, {params.get('y', '?')}).",
            "double_click":  f"Double-clicking at ({params.get('x', '?')}, {params.get('y', '?')}).",
            "scroll":        f"Scrolling {direction}.",
            "system_volume": f"Setting the volume to {level}.",
            "mute":          "Muting the audio.",
            "unmute":        "Unmuting - audio is coming back!",
            "sleep_system":  "Putting your Mac to sleep. Good night!",
            "lock_screen":   "Locking the screen. Stay safe!",
            "notify":        f"Sending you a notification: '{params.get('title', '')}'.",
            "compose_email": f"Drafting an email to {to}.",
            "send_email":    f"Sending the email to {to} right away.",
            "create_file":   f"Creating '{filename}' for you.",
            "open_file":     f"Opening {params.get('path', 'the file')}.",
            "add_contact":   f"Adding {name} to your contacts.",
            "execute_shell": f"Running: {cmd[:50]}{'…' if len(cmd) > 50 else ''}." if cmd else "Running the command.",
            "run_applescript": "Running the AppleScript.",
            "clipboard_set": "Updating your clipboard.",
        }
        return narrations.get(action, "")

    def _complete_message(self, action: str, params: dict) -> str:
        """Return a natural-language completion message after an action succeeds."""
        app      = params.get("app_name", "it")
        query    = params.get("query", "")
        platform = params.get("platform", "google").title()
        to       = params.get("to", "them")
        filename = params.get("filename", "the file")
        level    = params.get("level", "")
        name     = params.get("name", "them")
        url      = params.get("url", "")
        cmd      = params.get("command", "")

        try:
            from urllib.parse import urlparse
            host = urlparse(url).netloc.lstrip("www.") if url else ""
        except Exception:
            host = url

        phrases = {
            "open_app": [
                f"{app} is open and ready for you!",
                f"There you go - {app} is up!",
                f"I've opened {app}. What would you like to do?",
            ],
            "search_web": [
                f"Here are the {platform} results for '{query}'!" if query else f"{platform} search is up!",
                f"Done! Showing '{query}' results on {platform}." if query else f"Done! {platform} is open.",
            ],
            "open_url": [
                f"{host} is open!" if host else "The page is open!",
                "Got it - link is open.",
            ],
            "navigate_to_url": [
                f"{host} is open!" if host else "The page is open!",
                "Got it - link is open.",
            ],
            "switch_app":    [f"Switched to {app}!"],
            "close_window":  ["Window closed."],
            "quit_app":      [f"{app} is now closed."],
            "compose_email": [
                f"Your draft to {to} is ready in Mail. Review it and hit send when you're happy!",
                f"I've drafted the email to {to}. Check Mail before sending!",
            ],
            "send_email":    [f"Email sent to {to}! They should get it shortly."],
            "system_volume": [
                f"Volume is now at {level}. Sounds good!" if level else "Volume updated!",
                f"Done - volume set to {level}." if level else "Volume changed.",
            ],
            "mute":          ["Muted! Enjoy the silence."],
            "unmute":        ["Sound is back!"],
            "sleep_system":  ["Sweet dreams! 💤"],
            "lock_screen":   ["Screen locked. Stay safe!"],
            "notify":        [f"Notification '{params.get('title', '')}' sent!"],
            "create_file":   [
                f"'{filename}' has been created!",
                f"Created '{filename}' for you!",
            ],
            "open_file":     [f"Opened {params.get('path', 'the file')}!"],
            "execute_shell": [
                f"Command ran successfully." if not cmd else f"Done running: {cmd[:40]}{'…' if len(cmd) > 40 else ''}",
            ],
            "add_contact":   [f"Got it! {name} has been saved to your contacts."],
            "clipboard_set": ["Clipboard updated!"],
        }

        options = phrases.get(action, ["All done! What else can I help you with?"])
        return random.choice(options)



    # ── JSON Parser ───────────────────────────────────────────────────────────

    def _parse_single_action(self, text: str) -> dict:
        try:
            text = text.strip().replace("```json", "").replace("```", "").strip()
            start = text.find("{")
            if start == -1:
                return {}
            depth, end = 0, start
            for i, ch in enumerate(text[start:], start):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            data = json.loads(text[start:end])
            return data if "action" in data else {}
        except Exception as e:
            logger.error(f"Failed to parse action: {e} | text: {text[:200]}")
            return {}
