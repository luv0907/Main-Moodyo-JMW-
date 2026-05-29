#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# MoodyO Master Launcher
# Boots all agents in dependency order, waiting for each to be READY
# before starting the next one.
# ─────────────────────────────────────────────────────────────────────────────

set -e  # stop on any error

PURPLE='\033[95m'
CYAN='\033[96m'
GREEN='\033[92m'
YELLOW='\033[93m'
RED='\033[91m'
BOLD='\033[1m'
NC='\033[0m'

cleanup_ports() {
    local ports=(8000 8765 5001 3001 3002 8005 3003)
    echo -e "${YELLOW}[CLEANUP]${NC} Killing any processes on MoodyO ports..."
    for port in "${ports[@]}"; do
        local pid=$(lsof -ti:$port 2>/dev/null)
        if [ -n "$pid" ]; then
            kill -9 $pid 2>/dev/null
            echo -e "  Freed port ${port} (was PID ${pid})"
        fi
    done
    sleep 1
}

cleanup_ports

ROOT="$(cd "$(dirname "$0")" && pwd)"

log() { echo -e "${BOLD}${1}[MOODYO]${NC} $2"; }

# ─── Wait for a port to be open (replaces blind sleep) ───────────────────────
wait_for_port() {
    local port=$1
    local name=$2
    local max_wait=${3:-30}  # timeout in seconds
    local elapsed=0
    echo -ne "${CYAN}[WAIT]${NC} Waiting for ${BOLD}${name}${NC} on port ${port}..."
    while ! nc -z localhost "$port" 2>/dev/null; do
        sleep 0.5
        elapsed=$((elapsed + 1))
        if [ $elapsed -ge $((max_wait * 2)) ]; then
            echo ""
            echo -e "${RED}[ERROR]${NC} ${name} did not start within ${max_wait}s. Check logs above."
            exit 1
        fi
        echo -n "."
    done
    echo -e " ${GREEN}✓ ready${NC}"
}

# ─── Start a service in the background ───────────────────────────────────────
start_service() {
    local name=$1
    local dir=$2
    local cmd=$3
    local color=$4
    echo -e "${color}${BOLD}[${name}]${NC} Starting → ${dir}"
    cd "${ROOT}/${dir}" && eval "$cmd" &
    cd "$ROOT"
}

log "$PURPLE" "🚀 INITIALIZING MOODYO MULTI-PROJECT SUITE"
echo ""

# ── 0. MoodyO Core Brain (port 8000) ─────────────────────────────────────────
log "$PURPLE" "0/6 Starting MOODYO-CORE (the brain)..."
start_service "MOODYO-CORE" "moodyo_core" \
    "python -m uvicorn server:app --port 8000 --log-level warning" "$PURPLE"
wait_for_port 8000 "MOODYO-CORE"

# ── 1. JARVIS Voice Assistant (port 8765) ─────────────────────────────────────
log "$CYAN" "1/6 Starting JARVIS..."
start_service "JARVIS" "Voice-control-PC-assistant" \
    "./venv311/bin/python run_with_ui.py" "$CYAN"
wait_for_port 8765 "JARVIS" 40

# ── 2. WhatsApp AI Brain / Flask (port 5001) ──────────────────────────────────
log "$GREEN" "2/6 Starting WHATSAPP-BOT..."
start_service "WHATSAPP-BOT" "whats-app-chat-bot" \
    "python main.py" "$GREEN"
wait_for_port 5001 "WHATSAPP-BOT"

# ── 3. WhatsApp Node.js Ghost Engine (port 3001) ──────────────────────────────
log "$GREEN" "3/6 Starting WHATSAPP-CLIENT..."
start_service "WHATSAPP-CLIENT" "whats-app-chat-bot/whatsapp-client" \
    "node index.js" "$GREEN"
# Don't wait for port 3001 here — it shows a QR code first which takes time
echo -e "${YELLOW}[NOTE]${NC} Scan the QR code in the WHATSAPP-CLIENT terminal if prompted."
sleep 2

# ── 4. Moodyo Next.js App (port 3002) ────────────────────────────────────────
log "$YELLOW" "4/6 Starting MOODYO-APP..."
start_service "MOODYO-APP" "Moodyo" \
    "npm run dev" "$YELLOW"
wait_for_port 3002 "MOODYO-APP" 60

# ── 5. Scratch Sandbox Agent — Backend (port 8005) ───────────────────────────
log "$PURPLE" "5/6 Starting SCRATCH-CORE..."
start_service "SCRATCH-CORE" "scratch/sandbox_agent" \
    "python -m uvicorn server:app --port 8005 --log-level warning" "$PURPLE"
wait_for_port 8005 "SCRATCH-CORE" 15

# ── 6. Scratch Sandbox Agent — Frontend (port 3001) ──────────────────────────
log "$CYAN" "6/6 Starting SCRATCH-UI..."
start_service "SCRATCH-UI" "scratch/sandbox_agent/frontend" \
    "npm run dev -- -p 3003" "$CYAN"

echo ""
log "$PURPLE" "✅ ALL SERVICES OPERATIONAL"
echo ""
echo -e "  ${BOLD}Command Center:${NC}  http://localhost:3002/command-center"
echo -e "  ${BOLD}JARVIS UI:${NC}       http://localhost:8765"
echo -e "  ${BOLD}Core Brain API:${NC}  http://localhost:8000"
echo -e "  ${BOLD}Moodyo App:${NC}      http://localhost:3002"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to shut down all services${NC}"
echo ""

# ─── Keep alive + trap Ctrl+C for clean shutdown ─────────────────────────────
trap 'echo ""; log "$RED" "⏹️  Shutting down..."; kill $(jobs -p) 2>/dev/null; exit 0' INT TERM

wait
