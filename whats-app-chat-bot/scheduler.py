import logging
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import database
from message_sender import send_message

logger = logging.getLogger(__name__)

def check_pending_messages():
    logger.info("Checking for pending messages...")
    pending_messages = database.get_pending_messages()
    now = datetime.now()

    for row in pending_messages:
        try:
            # Parse datetime string from database (Format: 'YYYY-MM-DD HH:MM:SS' or similar)
            # SQLite stores TIMESTAMP as string if using basic queries.
            # Depending on how it's inserted, we might need to parse.
            # Example: '2026-03-12 18:00' or '2026-03-12 18:00:00'
            schedule_time_str = str(row['schedule_time'])
            
            # Format parsing (handle missing seconds if any)
            try:
                if len(schedule_time_str) == 16: # 'YYYY-MM-DD HH:MM'
                    schedule_time = datetime.strptime(schedule_time_str, '%Y-%m-%d %H:%M')
                else: # 'YYYY-MM-DD HH:MM:SS'
                    # Remove microseconds if they exist
                    clean_time_str = schedule_time_str.split('.')[0]
                    schedule_time = datetime.strptime(clean_time_str, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                # If it's already a datetime object (depends on SQLite adapter)
                if isinstance(row['schedule_time'], datetime):
                    schedule_time = row['schedule_time']
                else:
                    logger.error(f"Cannot parse schedule_time: {schedule_time_str} for message ID: {row['id']}")
                    continue

            if schedule_time <= now:
                logger.info(f"Triggering scheduled message ID: {row['id']}")
                success = send_message(row['platform'], row['recipient'], row['message'], row['subject'])
                
                if success:
                    database.update_message_status(row['id'], 'sent')
                    logger.info(f"Message ID: {row['id']} marked as sent.")
                else:
                    database.update_message_status(row['id'], 'failed')
                    logger.error(f"Message ID: {row['id']} failed to send.")
        
        except Exception as e:
            logger.error(f"Error processing message ID {row['id']}: {e}")

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run the check every 60 seconds
    scheduler.add_job(func=check_pending_messages, trigger="interval", seconds=60)
    scheduler.start()
    logger.info("APScheduler started successfully.")
    return scheduler
