"""
main.py — MoodyO WhatsApp Neural Link v2
─────────────────────────────────────────
Flask entry point. Initialises DB, registers blueprint, starts server.
"""

from flask import Flask, jsonify
from config import setup_logging, FLASK_PORT
import database
from whatsapp_bot import whatsapp_bp
import logging

# Logging first — before anything else
setup_logging()
logger = logging.getLogger(__name__)

# Initialise database (creates tables if they don't exist)
database.init_db()

# Flask app
app = Flask(__name__)

# Register blueprint — this wires up the /whatsapp route
app.register_blueprint(whatsapp_bp)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "MoodyO AI Brain v2"})


if __name__ == '__main__':
    logger.info("=" * 50)
    logger.info("  MoodyO AI Brain v2 starting...")
    logger.info(f"  Listening on port {FLASK_PORT}")
    logger.info(f"  Webhook: POST http://localhost:{FLASK_PORT}/whatsapp")
    logger.info("=" * 50)
    # debug=False is critical — debug=True runs the app twice
    # and creates duplicate scheduler threads
    app.run(host='0.0.0.0', port=FLASK_PORT, debug=False)