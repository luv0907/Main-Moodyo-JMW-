"""
interface/server.py
───────────────────
FastAPI WebSocket bridge between JarvisEngine and the browser UI.

  • Serves the interface/ static files at http://localhost:8765
  • Opens a WebSocket at ws://localhost:8765/ws
  • Exposes REST endpoints for contacts, memory, and status
  • engine.py publishes events by calling `emit(event_type, payload)`;
    the bridge relays them to every connected browser tab.
"""
from __future__ import annotations
import asyncio, json, os, threading, time
from typing import Any
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles

# ── Shared event queue (engine → browser) ───────────────────────────────────
# asyncio.Queue is not thread-safe to put() from sync threads directly, so we
# use a plain threading.Queue and drain it inside the async loop.
import queue as _queue_stdlib
_sync_q: "_queue_stdlib.Queue[dict]" = _queue_stdlib.Queue()


def emit(event_type: str, payload: dict | None = None) -> None:
    """
    Thread-safe emit called from the JARVIS engine (sync context).
    Works even if the FastAPI event loop hasn't started yet.
    """
    _sync_q.put({"type": event_type, **(payload or {})})


# ── Connection manager ───────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active = [c for c in self.active if c is not ws]

    async def broadcast(self, message: dict):
        dead = []
        text = json.dumps(message)
        for ws in self.active:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()

# ── Background task: drain sync queue → broadcast ───────────────────────────
async def _drain_queue():
    """Runs inside the FastAPI event loop, relays engine events to browsers."""
    while True:
        # non-blocking drain
        while not _sync_q.empty():
            try:
                event = _sync_q.get_nowait()
                await manager.broadcast(event)
            except Exception:
                pass
        await asyncio.sleep(0.05)   # 50ms tick


# ── App factory ─────────────────────────────────────────────────────────────
INTERFACE_DIR = Path(__file__).parent   # .../interface/
ROOT_DIR      = INTERFACE_DIR.parent    # project root
MEMORY_FILE   = ROOT_DIR / "jarvis_memory.json"
CONTACTS_FILE = ROOT_DIR / "contacts.json"

app = FastAPI(title="JARVIS Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ── REST endpoints ───────────────────────────────────────────────────────────
@app.get("/api/status")
async def api_status():
    return {"status": "online", "version": "2.4"}


class ExecuteRequest(BaseModel):
    command: str


@app.post("/api/execute")
async def api_execute(body: ExecuteRequest):
    """
    Called by MoodyO Core Brain to inject a command directly into JARVIS.
    The engine picks it up via get_browser_command() on its next polling cycle.
    """
    command = body.command.strip()
    if not command:
        return {"status": "error", "detail": "Empty command"}
    _inbound_q.put(command)
    return {"status": "queued", "command": command}

@app.get("/api/contacts")
async def api_contacts():
    try:
        data = json.loads(CONTACTS_FILE.read_text())
        return JSONResponse(data)
    except Exception:
        return JSONResponse({})

@app.get("/api/memory")
async def api_memory():
    try:
        entries = json.loads(MEMORY_FILE.read_text())
        count = len(entries) if isinstance(entries, list) else len(entries.get("entries", []))
        return {"count": count}
    except Exception:
        return {"count": 0}

# ── WebSocket endpoint ───────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    WebSocket handler for real-time communication with browser UI.
    - Receives commands from browser
    - Broadcasts engine events to all connected clients
    """
    await manager.connect(ws)
    # Send immediate confirmation
    await ws.send_text(json.dumps({"type": "status", "content": "Connected to JARVIS backend"}))
    
    try:
        while True:
            # Receive command from browser
            raw = await ws.receive_text()
            
            try:
                # Try to parse as JSON (structured command)
                msg = json.loads(raw)
                
                if msg.get("type") == "command":
                    text = msg.get("content", "").strip()
                    if text:
                        _inbound_q.put(text)
                        # Acknowledge receipt
                        await ws.send_text(json.dumps({
                            "type": "status",
                            "content": "Command received"
                        }))
                
                elif msg.get("type") == "voice_start":
                    # Browser requested voice listening
                    await ws.send_text(json.dumps({
                        "type": "status",
                        "content": "Voice listening started"
                    }))
                
                elif msg.get("type") == "voice_stop":
                    # Browser stopped voice listening
                    await ws.send_text(json.dumps({
                        "type": "status",
                        "content": "Voice listening stopped"
                    }))
                    
            except json.JSONDecodeError:
                # Raw text command (not JSON)
                text = raw.strip()
                if text:
                    _inbound_q.put(text)

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        manager.disconnect(ws)

# ── Inbound queue: browser → engine ─────────────────────────────────────────
# Engine polls this to receive typed commands from the browser.
_inbound_q: "_queue_stdlib.Queue[str]" = _queue_stdlib.Queue()

def get_browser_command(timeout: float = 0.1) -> str | None:
    """Called by engine to check for typed browser commands."""
    try:
        return _inbound_q.get(timeout=timeout)
    except _queue_stdlib.Empty:
        return None

# ── Startup / shutdown ───────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    """Start the background queue drain task."""
    asyncio.create_task(_drain_queue())

# ── Static files (serve the UI) — registered AFTER routes ───────────────────
app.mount("/", StaticFiles(directory=str(INTERFACE_DIR), html=True), name="static")

# ── Runtime entry point ──────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
