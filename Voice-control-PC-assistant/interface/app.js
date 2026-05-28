/* ═══════════════════════════════════════════════════════════
   JARVIS UI Logic — app.js
   Handles WebSocket communication and UI state management
   ═══════════════════════════════════════════════════════════ */

const socket = new WebSocket(`ws://${window.location.host}/ws`);
const messagesArea = document.getElementById('messages-area');
const commandInput = document.getElementById('command-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const navItems = document.querySelectorAll('.nav-item');
const tabs = document.querySelectorAll('.tab-content');

// ── Tab Switching ──
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetTab = item.getAttribute('data-tab');
        
        // Update Nav
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        // Update Tabs
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.id === `${targetTab}-tab`) {
                tab.classList.add('active');
            }
        });
    });
});

// ── Status Management ──
function updateStatus(state, label) {
    statusText.innerText = label || state.toUpperCase();
    statusBadge.className = 'status-badge ' + state.toLowerCase();
}

// ── Message Rendering ──
function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role.toLowerCase()}`;
    div.innerText = text;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    
    // Add subtle animation delay for impact
    div.style.opacity = '0';
    div.style.transform = 'translateY(10px)';
    setTimeout(() => {
        div.style.transition = 'all 0.3s ease-out';
        div.style.opacity = '1';
        div.style.transform = 'translateY(0)';
    }, 10);
}

// ── Three.js Neural Orb ──────────────────────────────────────────
let scene, camera, renderer, orb;
let orbSpeed = 0.005;

function init3D() {
    const canvas = document.getElementById('canvas-3d');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Create a complex wireframe orb (Neural Core)
    const geometry = new THREE.IcosahedronGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    orb = new THREE.Mesh(geometry, material);
    scene.add(orb);

    // Add a glowing core
    const coreGeo = new THREE.IcosahedronGeometry(0.8, 1);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.5 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    orb.add(core);

    camera.position.z = 5;

    function animate() {
        requestAnimationFrame(animate);
        orb.rotation.y += orbSpeed;
        orb.rotation.x += orbSpeed * 0.5;
        
        // Dynamic scaling based on speed (simulating life)
        const scale = 1 + Math.sin(Date.now() * 0.002) * 0.05;
        orb.scale.set(scale, scale, scale);
        
        renderer.render(scene, camera);
    }
    animate();
}

window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

init3D();

// ── WebSocket Communication ──
socket.onopen = () => {
    updateStatus('online', 'SYSTEM READY');
    orbSpeed = 0.002; // Calm idle
    console.log('Connected to JARVIS Bridge');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const { type, payload } = data;

    switch (type) {
        case 'jarvis_message':
            addMessage('assistant', payload.text);
            orbSpeed = 0.002;
            break;
            
        case 'user_message':
            addMessage('user', payload.text);
            orbSpeed = 0.02; // React to input
            break;
            
        case 'status':
            updateStatus(payload.state, payload.label);
            if (payload.state === 'thinking') orbSpeed = 0.05;
            else if (payload.state === 'acting') orbSpeed = 0.03;
            else orbSpeed = 0.002;
            break;
            
        case 'memory_update':
            refreshMemory(payload.memories);
            break;
            
        case 'stats_update':
            document.getElementById('actions-count').innerText = payload.actions;
            document.getElementById('memory-count').innerText = payload.memories;
            document.getElementById('uptime-count').innerText = payload.uptime;
            break;
    }
};

function refreshMemory(memories) {
    const memoryList = document.getElementById('memory-list');
    if (!memoryList) return;
    
    memoryList.innerHTML = '';
    memories.slice(-10).reverse().forEach(mem => {
        const row = document.createElement('div');
        row.className = 'memory-row';
        row.innerHTML = `
            <div class="mem-dot"></div>
            <div class="mem-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            <div class="mem-text">${mem}</div>
        `;
        memoryList.appendChild(row);
    });
}

// ── Input Handling ──
function sendMessage() {
    const text = commandInput.value.trim();
    if (!text) return;
    
    addMessage('user', text);
    socket.send(JSON.stringify({ type: 'command', text }));
    commandInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

voiceBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'start_listening' }));
    updateStatus('listening', 'LISTENING...');
});
