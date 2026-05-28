/**
 * MoodyO Ghost Engine v2 — index.js
 * ─────────────────────────────────
 * Uses whatsapp-web.js instead of raw Puppeteer DOM scraping.
 * whatsapp-web.js hooks into WhatsApp Web's internal JS engine —
 * it reads messages from memory, not HTML tags, so WhatsApp
 * cannot break it by changing CSS class names or DOM structure.
 *
 * INSTALL DEPS FIRST:
 *   npm install whatsapp-web.js qrcode-terminal express axios cors
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// ─── WhatsApp Client ────────────────────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'   // saves session — no re-scan needed
    }),
    puppeteer: {
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1280,800'
        ]
    }
});

// ─── QR Code ────────────────────────────────────────────────────────────────
client.on('qr', (qr) => {
    console.log('\n📱 Scan this QR code in WhatsApp (one-time only):');
    qrcode.generate(qr, { small: true });
});

// ─── Ready ──────────────────────────────────────────────────────────────────
client.on('ready', () => {
    console.log('✅ Ghost Engine v2 LIVE — WhatsApp connected.');
    console.log('👂 Listening for incoming messages...');
});

// ─── Auth failure ────────────────────────────────────────────────────────────
client.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
});

client.on('disconnected', (reason) => {
    console.warn('⚠️  WhatsApp disconnected:', reason);
});

// ─── THE NEURAL BRIDGE — Message received ───────────────────────────────────
client.on('message', async (msg) => {
    // Ignore group messages, status updates, and messages from yourself
    if (msg.fromMe) return;
    if (msg.isStatus) return;

    const chat = await msg.getChat();
    if (chat.isGroup) return;   // private chats only

    const contact = await msg.getContact();
    const sender = msg.from;                           // e.g. "919876543210@c.us"
    const name = contact.pushname || contact.name || sender;
    const body = msg.body.trim();

    if (!body) return;   // ignore voice notes / media with no caption

    console.log(`\n[📩 INCOMING] ${name} (${sender}): ${body}`);

    // Forward to Python AI Brain
    try {
        await axios.post('http://localhost:5001/whatsapp', {
            from: sender,
            name: name,
            body: body
        }, { timeout: 30000 });

        console.log(`[✅ FORWARDED] Sent to AI Brain.`);
    } catch (e) {
        console.error('[❌ ERR] AI Brain unreachable. Is Python running on port 5001?');
        console.error('        Details:', e.message);
    }
});

// ─── API: Receive reply from Python and send it ──────────────────────────────
app.post('/api/send', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing `to` or `message`' });
    }

    try {
        console.log(`\n[🤖 SENDING REPLY] To: ${to}`);
        console.log(`   Message: ${message.substring(0, 80)}...`);

        await client.sendMessage(to, message);

        console.log('[✅ REPLY SENT]');
        res.json({ success: true });
    } catch (e) {
        console.error('[❌ ERR] Failed to send reply:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: client.info ? 'connected' : 'connecting'
    });
});

// ─── Start ───────────────────────────────────────────────────────────────────
client.initialize();

app.listen(PORT, () => {
    console.log(`🚀 Ghost Engine v2 API running at http://localhost:${PORT}`);
    console.log('   Waiting for WhatsApp to connect...\n');
});