# MoodyO WhatsApp Neural Link v2

## The core change: whatsapp-web.js replaces raw Puppeteer

Old approach scraped HTML tags to detect messages.
WhatsApp kept changing their DOM so it broke constantly.

New approach hooks into WhatsApp Web's internal JavaScript engine
and reads messages directly from memory — WhatsApp cannot break this
by changing CSS classes or DOM structure.

---

## Setup

### Step 1 — Install Node.js dependencies

```bash
cd whatsapp-client
npm install whatsapp-web.js qrcode-terminal express axios cors
```

### Step 2 — Install Python dependencies

```bash
pip install flask requests
```

### Step 3 — Add your NVIDIA API key

Open `config.py` and replace:
```python
NVIDIA_API_KEY = "YOUR_NVIDIA_API_KEY_HERE"
```

### Step 4 — Start Python AI Brain FIRST

```bash
python main.py
```

You should see:
```
==================================================
  MoodyO AI Brain v2 starting...
  Listening on port 5001
  Webhook: POST http://localhost:5001/whatsapp
==================================================
```

### Step 5 — Start Node.js Ghost Engine

```bash
cd whatsapp-client
node index.js
```

First run: a QR code appears in the terminal.
Open WhatsApp on your phone -> Linked Devices -> Link a Device -> scan it.

After that, you will see:
```
✅ Ghost Engine v2 LIVE — WhatsApp connected.
👂 Listening for incoming messages...
```

The session is saved. You will NOT need to scan again on restarts.

---

## How it works now

```
Patient sends WhatsApp message
        |
whatsapp-web.js fires 'message' event (reads from memory, not DOM)
        |
Node.js -> POST localhost:5001/whatsapp { from, name, body }
        |
Flask /whatsapp receives it
        |
reply_engine.py pulls last 20 messages from SQLite
        |
Builds full conversation array -> NVIDIA AI (Llama 3.1 70B)
        |
Ajju generates human-like reply with memory of past conversation
        |
save_message() stores user turn + assistant turn in SQLite
        |
whatsapp_service.py -> POST localhost:3001/api/send { to, message }
        |
Node.js calls client.sendMessage(to, message)
        |
Patient receives reply via official WhatsApp Web JS client
```

---

## File structure

```
whats-app-chat-bot/
├── whatsapp-client/
│   └── index.js          Ghost Engine (Node.js + whatsapp-web.js)
├── database.py           SQLite memory (conversations + profiles)
├── reply_engine.py       Ajju AI persona + NVIDIA AI calls
├── whatsapp_bot.py       Flask Blueprint (/whatsapp route)
├── whatsapp_service.py   Sends reply back to Node.js
├── config.py             API keys and ports
├── main.py               Flask entry point
└── messaging_bot.db      Auto-created on first run
```

---

## Upgrading to Firebase later

In `database.py`, replace `sqlite3` calls with Firebase Admin SDK calls.
The function signatures (`save_message`, `get_history`, etc.) stay identical —
nothing else in the codebase needs to change.