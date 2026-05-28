'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, Cpu, MessageCircle, Music, Terminal,
  Wifi, WifiOff, Loader2, ChevronRight, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentStatus {
  jarvis: 'online' | 'offline' | 'error' | 'loading';
  whatsapp: 'online' | 'offline' | 'error' | 'loading';
  moodyo: 'online' | 'offline' | 'error' | 'loading';
}

interface CommandResult {
  id: string;
  command: string;
  results: Array<{
    intent: { intent: string; mood?: string; command?: string; contact?: string };
    success: boolean;
    agent: string;
    detail?: string;
    error?: string;
    redirect?: string;
  }>;
  parallel: boolean;
  timestamp: Date;
}

interface WhatsAppChat {
  sender: string;
  role: string;
  content: string;
  timestamp: string;
  display_name: string;
}

interface JarvisActivity {
  type: string;
  content: string;
  timestamp: Date;
}

interface ContextData {
  context: Record<string, string>;
  history: Array<{ command: string; agent: string; success: boolean; created_at: string }>;
  insight: string | null;
}

const CORE_URL = 'http://localhost:8000';
const JARVIS_WS_URL = 'ws://localhost:8765/ws';

// ─── Agent status dot ────────────────────────────────────────────────────────
function StatusDot({ status }: { status: AgentStatus[keyof AgentStatus] }) {
  return (
    <span className={cn(
      'w-2 h-2 rounded-full flex-none',
      status === 'online' && 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse',
      status === 'offline' && 'bg-red-400',
      status === 'error' && 'bg-amber-400',
      status === 'loading' && 'bg-slate-400 animate-pulse',
    )} />
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────
function AgentCard({
  icon: Icon, label, status, description, accentColor,
}: {
  icon: React.ElementType;
  label: string;
  status: AgentStatus[keyof AgentStatus];
  description: string;
  accentColor: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5"
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: accentColor }}
      />
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${accentColor}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <StatusDot status={status} />
          <span className="text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
            {status}
          </span>
        </div>
      </div>
      <h3 className="font-bold text-white text-sm mb-1">{label}</h3>
      <p className="text-xs text-slate-400">{description}</p>
    </motion.div>
  );
}

// ─── Command bubble — handles single OR parallel results ─────────────────────
function CommandBubble({ result }: { result: CommandResult }) {
  const intentColors: Record<string, string> = {
    MUSIC: '#a78bfa', JARVIS: '#38bdf8', WHATSAPP: '#4ade80',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-1"
    >
      {/* User command */}
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-white/10 text-white text-sm backdrop-blur-sm border border-white/10">
          {result.command}
          {result.parallel && (
            <span className="ml-2 text-[9px] text-violet-400 font-bold uppercase tracking-widest">
              ⚡ parallel
            </span>
          )}
        </div>
      </div>

      {/* One row per agent result */}
      {result.results.map((r, i) => {
        const color = intentColors[r.intent?.intent] ?? '#94a3b8';
        return (
          <div key={i} className="flex items-start gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-none mt-0.5"
              style={{ background: `${color}20`, border: `1px solid ${color}30` }}
            >
              <Activity className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div
              className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm backdrop-blur-sm border border-white/10"
              style={{ background: `${color}10` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full"
                  style={{ background: `${color}20`, color }}
                >
                  {r.intent?.intent ?? 'SYSTEM'}
                </span>
                {r.success
                  ? <span className="text-[9px] text-emerald-400 font-semibold">✓ dispatched</span>
                  : <span className="text-[9px] text-red-400 font-semibold">✗ failed</span>}
              </div>
              <p className="text-slate-300 text-xs">
                {r.redirect
                  ? `🎵 Navigating to /${r.intent.mood} playlist`
                  : r.error ?? JSON.stringify(r.detail ?? 'ok')}
              </p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CommandResult[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    jarvis: 'loading', whatsapp: 'loading', moodyo: 'online',
  });
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [jarvisLog, setJarvisLog] = useState<JarvisActivity[]>([]);
  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);

  // ── Scroll chat to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results]);

  // ── Poll agent status ──────────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${CORE_URL}/status`);
        if (res.ok) {
          const data = await res.json();
          setAgentStatus({
            jarvis: data.jarvis ?? 'offline',
            whatsapp: data.whatsapp ?? 'offline',
            moodyo: 'online',
          });
        }
      } catch {
        setAgentStatus(prev => ({ ...prev, jarvis: 'offline', whatsapp: 'offline' }));
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Poll WhatsApp chats ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await fetch(`${CORE_URL}/whatsapp/chats?limit=30`);
        if (res.ok) { const data = await res.json(); setChats(data.chats ?? []); }
      } catch { /* offline */ }
    };
    fetchChats();
    const interval = setInterval(fetchChats, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Poll Context Store ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(`${CORE_URL}/context`);
        if (res.ok) setContextData(await res.json());
      } catch { /* offline */ }
    };
    fetchContext();
    const interval = setInterval(fetchContext, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── JARVIS WebSocket ───────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(JARVIS_WS_URL);
        wsRef.current = ws;
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            setJarvisLog(prev => [
              { type: msg.type ?? 'event', content: msg.content ?? JSON.stringify(msg), timestamp: new Date() },
              ...prev.slice(0, 49),
            ]);
          } catch { /* ignore */ }
        };
        ws.onerror = () => ws.close();
      } catch { /* JARVIS offline */ }
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  // ── Send command to Core Brain ─────────────────────────────────────────────
  const sendCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setCommand('');
    setIsLoading(true);

    try {
      const res = await fetch(`${CORE_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed }),
      });
      const data = await res.json();

      // Normalise: server returns either single result or { parallel, results[] }
      const isParallel = !!data.parallel;
      const resultItems = isParallel
        ? data.results
        : [{ intent: data.intent, success: data.success, agent: data.agent,
             detail: data.detail ? JSON.stringify(data.detail) : undefined,
             error: data.error, redirect: data.redirect }];

      const result: CommandResult = {
        id: Date.now().toString(),
        command: trimmed,
        results: resultItems,
        parallel: isParallel,
        timestamp: new Date(),
      };
      setResults(prev => [...prev, result]);

      // Navigate if Moodyo redirect
      const redirect = data.redirect ?? resultItems.find((r: any) => r.redirect)?.redirect;
      if (redirect) window.location.href = redirect;

    } catch {
      setResults(prev => [...prev, {
        id: Date.now().toString(),
        command: trimmed,
        results: [{ intent: { intent: 'ERROR' }, success: false, agent: 'CORE',
                    error: 'Core Brain is offline. Start it with ./run.sh' }],
        parallel: false,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Voice input ───────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Try Chrome.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      sendCommand(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, sendCommand]);

  const examples = [
    "Play something happy",
    "Play lofi and open Notion",
    "Open Chrome and search YouTube",
    "Tell Riya I'll be late",
    "Take a screenshot",
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-32">

      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl"
          style={{ background: 'radial-gradient(circle, #0ea5e9, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-6 blur-3xl"
          style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 pt-10">

        {/* ── Header ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Cpu className="w-4.5 h-4.5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">MoodyO Command Center</h1>
          </div>
          <p className="text-sm text-slate-400 ml-12">One command. Any agent. Everything connected.</p>
        </motion.div>

        {/* ── Agent Status Cards ──────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <AgentCard
            icon={Music}
            label="Moodyo"
            status={agentStatus.moodyo}
            description="Mood-based music streaming"
            accentColor="#a78bfa"
          />
          <AgentCard
            icon={Terminal}
            label="JARVIS"
            status={agentStatus.jarvis}
            description="PC & browser automation"
            accentColor="#38bdf8"
          />
          <AgentCard
            icon={MessageCircle}
            label="WhatsApp Bot"
            status={agentStatus.whatsapp}
            description="AI-powered auto-replies"
            accentColor="#4ade80"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Command Terminal (left + center) ──────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Chat log */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/10 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="ml-2 text-xs font-mono text-slate-400">moodyo_core ~ command</span>
              </div>

              <div className="p-5 min-h-72 max-h-[420px] overflow-y-auto space-y-4">
                {results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-60 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                      <Cpu className="w-7 h-7 text-slate-500" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium mb-1">Core Brain is ready</p>
                    <p className="text-xs text-slate-600">Type a command below or try an example</p>
                  </div>
                ) : (
                  results.map(r => <CommandBubble key={r.id} result={r} />)
                )}
                {isLoading && (
                  <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Classifying intent & dispatching...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Example chips */}
            {results.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {examples.map(ex => (
                  <button
                    key={ex}
                    onClick={() => sendCommand(ex)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs text-slate-300 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-300 transition-all duration-200"
                  >
                    {ex} <ChevronRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <button
                id="voice-toggle-btn"
                onClick={toggleVoice}
                className={cn(
                  'w-10 h-10 rounded-xl flex-none flex items-center justify-center transition-all duration-200',
                  isListening
                    ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-violet-400 hover:border-violet-500/40'
                )}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                id="command-input"
                type="text"
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isLoading && sendCommand(command)}
                placeholder="Tell JARVIS to open Chrome, play music, or message someone..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />

              <button
                id="send-command-btn"
                onClick={() => sendCommand(command)}
                disabled={isLoading || !command.trim()}
                className={cn(
                  'w-10 h-10 rounded-xl flex-none flex items-center justify-center transition-all duration-200',
                  command.trim() && !isLoading
                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-white/5 text-slate-600 cursor-not-allowed'
                )}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ── Side panels ─────────────────────────────────────── */}
          <div className="space-y-4">

            {/* JARVIS Live Feed */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={agentStatus.jarvis} />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">JARVIS Feed</span>
                </div>
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="p-3 h-48 overflow-y-auto space-y-1 font-mono">
                <AnimatePresence initial={false}>
                  {jarvisLog.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center mt-14">JARVIS activity will appear here</p>
                  ) : (
                    jarvisLog.map((entry, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[10px] text-sky-400 leading-relaxed"
                      >
                        <span className="text-slate-600">{entry.timestamp.toLocaleTimeString()} </span>
                        {entry.content}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* WhatsApp Chats */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={agentStatus.whatsapp} />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Recent Chats</span>
                </div>
                <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="p-3 h-52 overflow-y-auto space-y-2">
                {chats.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center mt-14">
                    {agentStatus.whatsapp === 'offline' ? 'WhatsApp bot is offline' : 'No recent chats'}
                  </p>
                ) : (
                  chats.map((chat, i) => (
                    <div key={i} className={cn(
                      'rounded-lg px-3 py-2 text-xs border',
                      chat.role === 'user'
                        ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300'
                        : 'bg-white/5 border-white/5 text-slate-400'
                    )}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-[10px] uppercase tracking-wide">
                          {chat.role === 'user' ? chat.display_name : 'Ajju (Bot)'}
                        </span>
                        <span className="text-[9px] text-slate-600 ml-auto">
                          {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="truncate">{chat.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Context Panel */}
            {contextData && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Brain Context</span>
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="p-3 space-y-2">
                  {contextData.context.current_mood && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wide">Mood</span>
                      <span className="text-xs text-violet-300 ml-auto capitalize">{contextData.context.current_mood}</span>
                    </div>
                  )}
                  {contextData.context.last_agent && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Last agent</span>
                      <span className="text-xs text-slate-300 ml-auto">{contextData.context.last_agent}</span>
                    </div>
                  )}
                  <div className="pt-1 space-y-1">
                    {contextData.history.slice(0, 5).map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className={h.success ? 'text-emerald-500' : 'text-red-500'}>{'✓'}</span>
                        <span className="text-slate-500 font-mono">[{h.agent}]</span>
                        <span className="text-slate-400 truncate">{h.command}</span>
                      </div>
                    ))}
                  </div>

                  {/* Proactive insight banner */}
                  <AnimatePresence>
                    {contextData.insight && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 px-3 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-amber-400 text-xs mt-0.5 flex-none">💡</span>
                          <p className="text-[10px] text-amber-200/80 leading-relaxed">
                            {contextData.insight}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  );
}
