import smtplib
from email.message import EmailMessage
import logging
from config import Config

logger = logging.getLogger(__name__)

def send_email(recipient, subject, message):
    user = Config.EMAIL_USER
    password = Config.EMAIL_PASSWORD

    if not user or not password:
        logger.warning(f"Email credentials not configured. Mocking email to {recipient}")
        logger.info(f"[MOCK EMAIL] To: {recipient} | Subject: {subject} | Body: {message}")
        return True

    try:
        msg = EmailMessage()
        msg.set_content(message)
        msg['Subject'] = subject
        msg['From'] = user
        msg['To'] = recipient

        # Using Gmail SMTP as standard, modify if needed
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(user, password)
        server.send_message(msg)
        server.quit()
        
        logger.info(f"Email sent successfully to {recipient}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient}. Error: {e}")
        return False
