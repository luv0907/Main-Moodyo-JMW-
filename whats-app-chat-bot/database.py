"""
database.py — MoodyO WhatsApp Neural Link v2 (Firebase Edition)
─────────────────────────────────────────────
Firebase memory layer. Two collections:
  whatsapp_conversations   — every message turn (user + assistant)
  whatsapp_profiles        — display name, first/last seen, message count
"""

import os
import logging
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

logger = logging.getLogger(__name__)

# Initialize Firebase
def init_db():
    if not firebase_admin._apps:
        try:
            # Assumes serviceAccountKey.json is in the root of whats-app-chat-bot/
            cred_path = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info("✅ Firebase Database initialised.")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Firebase: {e}")
            logger.error("Please ensure serviceAccountKey.json is in the whats-app-chat-bot directory!")

def get_db():
    return firestore.client()

def is_bot_enabled() -> bool:
    """Check if the auto-reply bot is enabled via Firebase toggle."""
    try:
        db = get_db()
        doc = db.collection('whatsapp_config').document('settings').get()
        if doc.exists:
            return doc.to_dict().get('auto_reply_enabled', True)
        return True # Default to ON if document doesn't exist
    except Exception as e:
        logger.error(f"Error reading bot state: {e}")
        return True

def save_message(sender: str, role: str, message: str):
    """
    Persist one message turn (user or assistant) to Firebase.
    Also upserts last_seen + msg_count in whatsapp_profiles.
    """
    db = get_db()
    now = datetime.now()
    
    # 1. Save message to whatsapp_conversations
    db.collection('whatsapp_conversations').add({
        'sender': sender,
        'role': role,
        'message': message,
        'created_at': now
    })
    
    # 2. Upsert profile
    profile_ref = db.collection('whatsapp_profiles').document(sender)
    profile_doc = profile_ref.get()
    
    if profile_doc.exists:
        profile_ref.update({
            'last_seen': now,
            'msg_count': firestore.Increment(1)
        })
    else:
        profile_ref.set({
            'sender': sender,
            'first_seen': now,
            'last_seen': now,
            'msg_count': 1,
            'name': 'Unknown'
        })

def get_history(sender: str, limit: int = 20) -> list:
    """
    Return last `limit` turns for this sender, ordered oldest -> newest.
    Returns list of {"role": ..., "content": ...} dicts.
    """
    db = get_db()
    
    # Fetch messages without order_by to bypass the composite index requirement
    query = db.collection('whatsapp_conversations').where('sender', '==', sender)
              
    docs = query.stream()
    
    # Convert to list
    all_rows = []
    for doc in docs:
        data = doc.to_dict()
        all_rows.append(data)
        
    # Sort in memory by created_at
    all_rows.sort(key=lambda x: x.get("created_at", datetime.min))
    
    # Take the last `limit` rows
    recent_rows = all_rows[-limit:] if limit else all_rows
    
    # Format for AI model
    formatted_history = []
    for row in recent_rows:
        formatted_history.append({"role": row["role"], "content": row["message"]})
        
    return formatted_history

def upsert_profile_name(sender: str, name: str):
    """Store or update the WhatsApp display name for this sender."""
    db = get_db()
    profile_ref = db.collection('whatsapp_profiles').document(sender)
    profile_doc = profile_ref.get()
    
    if profile_doc.exists:
        profile_ref.update({
            'name': name,
            'last_seen': datetime.now()
        })
    else:
        profile_ref.set({
            'sender': sender,
            'name': name,
            'first_seen': datetime.now(),
            'last_seen': datetime.now(),
            'msg_count': 0
        })

def get_profile(sender: str):
    """Return the profile dict, or None."""
    db = get_db()
    doc = db.collection('whatsapp_profiles').document(sender).get()
    return doc.to_dict() if doc.exists else None