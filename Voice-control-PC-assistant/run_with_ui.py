"""
run_with_ui.py
──────────────
Single-command launcher: starts the FastAPI bridge + JarvisEngine together.

Usage:
    source .venv/bin/activate
    python run_with_ui.py

The browser will auto-open to http://localhost:8765 after startup.
Press Ctrl+C to shut everything down cleanly.
"""
from __future__ import annotations
import sys, os, threading, time, webbrowser, logging

# ── Ensure src/ is on path ────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "src"))
sys.path.insert(0, ROOT)   # so "interface.server" resolves correctly

# ── Import bridge FIRST (so emit is available before engine loads) ─────────────
from interface.server import app as fastapi_app, emit as bridge_emit

# ── Register the emit function with the engine module ─────────────────────────
import jarvis.engine as engine_mod
engine_mod.set_ui_emit(bridge_emit)

# ── Imports ────────────────────────────────────────────────────────────────────
from jarvis.engine import JarvisEngine
from jarvis.utils.logger import logger

PORT = 8765

def start_uvicorn():
    """Run FastAPI/Uvicorn in a daemon thread."""
    import uvicorn
    uvicorn.run(
        fastapi_app,
        host="0.0.0.0",
        port=PORT,
        log_level="warning",   # keep terminal clean
    )

def main():
    """Main entry point."""
    logger.info("=" * 70)
    logger.info("  🎤 JARVIS Modern Voice Control Assistant")
    logger.info(f"  🌐 Web Interface: http://localhost:{PORT}")
    logger.info("  📝 Check terminal for voice commands")
    logger.info("=" * 70)

    # ── 1. Start FastAPI server in background thread ──────────────────────────
    server_thread = threading.Thread(target=start_uvicorn, daemon=True)
    server_thread.start()
    
    # Wait for server to start
    time.sleep(2)
    
    # ── 2. Open browser automatically ──────────────────────────────────────────
    try:
        webbrowser.open(f"http://localhost:{PORT}")
        logger.info("✅ Browser opened")
    except Exception as e:
        logger.warning(f"Could not auto-open browser: {e}")
        logger.info(f"📖 Manually navigate to http://localhost:{PORT}")
    
    # ── 3. Initialize and run JARVIS engine (blocking) ────────────────────────
    try:
        engine = JarvisEngine()
        engine.initialize()
        logger.info("✅ JARVIS engine ready. Listening for commands...")
        engine.run()
    except KeyboardInterrupt:
        logger.info("⏹️  Shutting down JARVIS...")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"❌ Engine failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
