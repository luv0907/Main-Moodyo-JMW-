#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Installing MoodyO Core dependencies..."
cd "$ROOT/moodyo_core" && pip install -r requirements.txt

echo "Installing JARVIS dependencies..."
cd "$ROOT/Voice-control-PC-assistant" && pip install -r requirements.txt

echo "Installing WhatsApp Bot dependencies..."
cd "$ROOT/whats-app-chat-bot" && pip install -r requirements.txt

echo "Installing Node dependencies..."
cd "$ROOT/whats-app-chat-bot/whatsapp-client" && npm install
cd "$ROOT/Moodyo" && npm install

echo "All dependencies installed."
