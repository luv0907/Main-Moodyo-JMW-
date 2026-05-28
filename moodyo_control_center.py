import subprocess
import os
import signal
import sys
import time

# Colors for terminal output
class Colors:
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log(service, message, color=Colors.CYAN):
    print(f"{color}{Colors.BOLD}[{service}]{Colors.ENDC} {message}")

class ProjectManager:
    def __init__(self):
        self.processes = []
        self.root_dir = os.path.dirname(os.path.abspath(__file__))

    def start_service(self, name, cwd, command, color):
        log(name, f"Starting in {cwd}...", color)
        # Use full path to python if needed, or relative to cwd
        full_cwd = os.path.join(self.root_dir, cwd)
        
        # Check for venv
        venv_python = os.path.join(full_cwd, "venv", "bin", "python")
        if not os.path.exists(venv_python):
            venv_python = os.path.join(full_cwd, "venv311", "bin", "python")
        if not os.path.exists(venv_python):
            venv_python = "python" # fallback

        cmd_list = command.split()
        if cmd_list[0] == "python":
            cmd_list[0] = venv_python
        elif cmd_list[0] == "node":
            # Find node in system PATH for Node.js commands
            import shutil
            node_path = shutil.which("node") or "node"
            cmd_list[0] = node_path
        elif cmd_list[0] == "npm":
            import shutil
            npm_path = shutil.which("npm") or "npm"
            cmd_list[0] = npm_path

        proc = subprocess.Popen(
            cmd_list,
            cwd=full_cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        self.processes.append((name, proc, color))
        
        # Start a thread to stream output
        import threading
        def stream_output(p, n, c):
            for line in p.stdout:
                if line.strip():
                    print(f"{c}[{n}]{Colors.ENDC} {line.strip()}")
        
        threading.Thread(target=stream_output, args=(proc, name, color), daemon=True).start()

    def run_all(self):
        log("SYSTEM", "🚀 INITIALIZING MOODYO MULTI-PROJECT SUITE", Colors.PURPLE)
        
        # 0. MoodyO Core Brain (must start FIRST — all agents depend on it)
        self.start_service(
            "MOODYO-CORE",
            "moodyo_core",
            "python -m uvicorn server:app --port 8000",
            Colors.PURPLE
        )
        
        time.sleep(3)  # Give Core Brain time to be ready
        
        # 1. JARVIS Voice Assistant
        self.start_service(
            "JARVIS", 
            "Voice-control-PC-assistant", 
            "python run_with_ui.py", 
            Colors.CYAN
        )
        
        time.sleep(2) # Give JARVIS a head start
        
        # 2. WhatsApp Chat Bot (Backend)
        self.start_service(
            "WHATSAPP-BOT", 
            "whats-app-chat-bot", 
            "python main.py", 
            Colors.GREEN
        )
        
        # 2.1 WhatsApp Chat Bot (Node.js Client)
        self.start_service(
            "WHATSAPP-CLIENT", 
            "whats-app-chat-bot/whatsapp-client", 
            "node index.js", 
            Colors.BOLD + Colors.GREEN
        )
        
        # 3. Moodyo Web App (Next.js)
        self.start_service(
            "MOODYO-APP", 
            "Moodyo", 
            "npm run dev", 
            Colors.YELLOW
        )

        # 4. Scratch Sandbox Agent (Backend)
        self.start_service(
            "SCRATCH-CORE",
            "scratch/sandbox_agent",
            "python -m uvicorn server:app --port 8005",
            Colors.PURPLE
        )

        # 5. Scratch Sandbox Agent (Frontend)
        # Note: Next.js dev server defaults to 3000, but we'll let it use what it wants
        self.start_service(
            "SCRATCH-UI",
            "scratch/sandbox_agent/frontend",
            "npm run dev -- -p 3001",
            Colors.BOLD + Colors.CYAN
        )

        log("SYSTEM", "✅ ALL SERVICES OPERATIONAL", Colors.PURPLE)
        
        try:
            while True:
                time.sleep(1)
                # Check if any process died
                for name, proc, color in self.processes:
                    if proc.poll() is not None:
                        log(name, "CRITICAL: Process terminated unexpectedly!", Colors.RED)
                        self.shutdown()
                        return
        except KeyboardInterrupt:
            self.shutdown()

    def shutdown(self):
        log("SYSTEM", "⏹️ SHUTTING DOWN ALL SERVICES...", Colors.RED)
        for name, proc, color in self.processes:
            log(name, "Terminating...", color)
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        log("SYSTEM", "✅ SHUTDOWN COMPLETE", Colors.PURPLE)
        sys.exit(0)

if __name__ == "__main__":
    manager = ProjectManager()
    manager.run_all()
