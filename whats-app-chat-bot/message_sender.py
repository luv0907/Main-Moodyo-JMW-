import logging
from email_service import send_email
from whatsapp_service import send_reply

logger = logging.getLogger(__name__)

def send_message(platform, recipient, message, subject=None):
    if platform.lower() == 'email':
        return send_email(recipient, subject or "Scheduled Message", message)
    elif platform.lower() == 'whatsapp':
        return send_reply(recipient, message)
    else:
        logger.error(f"Unsupported platform: {platform}")
        return False
