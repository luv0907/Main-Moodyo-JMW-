'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Activity, ShieldCheck, Zap, Layers, Cpu } from 'lucide-react';
import { useFaceDetection, DetectedMood } from '@/hooks/use-face-detection';
import { useSessionPreferences } from '@/hooks/use-session-preferences';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { PlaylistChoiceDialog } from '@/components/PlaylistChoiceDialog';
import { cn } from '@/lib/utils';

// Key connections for a realistic face mesh (partial list of 468 indices)
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 61];
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362];

interface MoodScannerProps {
    isOpen?: boolean;
    onClose: () => void;
}

export const MoodScanner: React.FC<MoodScannerProps> = ({ isOpen = false, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { detectMood, isLoading, resetHistory } = useFaceDetection();
    const { getPreference } = useSessionPreferences();
    const [detectedMood, setDetectedMood] = useState<DetectedMood>('neutral');
    const [confidence, setConfidence] = useState(0);
    const [isScanning, setIsScanning] = useState(false);
    const [showPlaylistChoice, setShowPlaylistChoice] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
    const router = useRouter();
    const navigationTriggered = useRef(false);

    // Camera Init
    useEffect(() => {
        if (!isOpen) return;
        let stream: MediaStream | null = null;
        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: 1280, height: 720 }
                });
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) { console.error(err); }
        };
        startCamera();
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            navigationTriggered.current = false;
            resetHistory();
        };
    }, [isOpen]);

    // Drawing Utils
    const drawMesh = (ctx: CanvasRenderingContext2D, landmarks: any[], indices: number[], color: string, lineWidth = 1) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        indices.forEach((idx, i) => {
            const pt = landmarks[idx];
            const x = pt.x * canvasRef.current!.width;
            const y = pt.y * canvasRef.current!.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
    };

    // Main Loop
    useEffect(() => {
        if (!isScanning || isLoading || !videoRef.current || !canvasRef.current || navigationTriggered.current) return;

        let animationFrameId: number;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const processFrame = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && !navigationTriggered.current) {
                // Skip frame if video hasn't loaded dimensions yet
                if (video.readyState < 2 || video.videoWidth === 0) {
                    animationFrameId = requestAnimationFrame(processFrame);
                    return;
                }

                const result = detectMood(video);
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (result.landmarks) {
                    const w = canvas.width;
                    const h = canvas.height;

                    // 1. Draw ALL 468 points as small glowing dots
                    ctx.fillStyle = '#00FFCC';
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = '#00FFCC';
                    result.landmarks.forEach((pt) => {
                        ctx.beginPath();
                        ctx.arc(pt.x * w, pt.y * h, 1, 0, Math.PI * 2);
                        ctx.fill();
                    });

                    // 2. Draw THE MESH LINES
                    ctx.shadowBlur = 0;
                    drawMesh(ctx, result.landmarks, FACE_OVAL, 'rgba(0, 255, 204, 0.5)', 2);
                    drawMesh(ctx, result.landmarks, LIPS_OUTER, 'rgba(0, 255, 204, 0.8)', 2);
                    drawMesh(ctx, result.landmarks, LEFT_EYE, 'rgba(0, 255, 204, 0.8)', 2);
                    drawMesh(ctx, result.landmarks, RIGHT_EYE, 'rgba(0, 255, 204, 0.8)', 2);

                    // 3. Draw "Neural Tesselation" (random connections for 468 landmarks to create the web)
                    ctx.strokeStyle = 'rgba(0, 255, 204, 0.1)';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    for (let i = 0; i < result.landmarks.length; i += 7) {
                        const pt = result.landmarks[i];
                        ctx.moveTo(pt.x * w, pt.y * h);
                        const next = result.landmarks[(i + 13) % 468];
                        ctx.lineTo(next.x * w, next.y * h);
                    }
                    ctx.stroke();
                }

                if (result.mood !== 'neutral') {
                    setDetectedMood(result.mood);
                    setConfidence(result.confidence);

                    if (result.isStable) {
                        navigationTriggered.current = true;
                        // LOCK ON EFFECT
                        ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        handleStableMoodDetection(result.mood);
                    }
                }
            }
            if (!navigationTriggered.current) animationFrameId = requestAnimationFrame(processFrame);
        };

        processFrame();
        return () => cancelAnimationFrame(animationFrameId);
    }, [isScanning, isLoading, detectMood]);

    const handleStableMoodDetection = (mood: DetectedMood) => {
        if (mood === 'happy' || mood === 'joyfull') {
            setTimeout(() => {
                router.push(`/${mood}`);
                onClose();
            }, 1000);
            return;
        }

        if (mood === 'sad' || mood === 'depressed') {
            const pref = getPreference(mood);
            if (pref?.dontAskAgain) {
                router.push(`/${pref.playlist}`);
                onClose();
            } else {
                setPendingNavigation(mood);
                setShowPlaylistChoice(true);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4"
            >
                <div className="relative w-full max-w-6xl aspect-[16/10] bg-[#080808] rounded-[48px] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,255,204,0.1)] flex flex-col md:flex-row">
                    
                    {/* Camera Feed */}
                    <div className="relative flex-1 bg-black overflow-hidden">
                        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale" />
                        <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 w-full h-full object-cover z-10" />
                        
                        {/* HUD Overlays */}
                        <div className="absolute inset-0 pointer-events-none z-20">
                            {/* Scanning Laser */}
                            {isScanning && !navigationTriggered.current && (
                                <motion.div 
                                    animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 w-full h-[2px] bg-[#00FFCC] shadow-[0_0_20px_#00FFCC] opacity-50"
                                />
                            )}
                            
                            {/* Corners */}
                            <div className="absolute top-12 left-12 w-16 h-16 border-t-4 border-l-4 border-[#00FFCC]/40 rounded-tl-3xl" />
                            <div className="absolute top-12 right-12 w-16 h-16 border-t-4 border-r-4 border-[#00FFCC]/40 rounded-tr-3xl" />
                            <div className="absolute bottom-12 left-12 w-16 h-16 border-b-4 border-l-4 border-[#00FFCC]/40 rounded-bl-3xl" />
                            <div className="absolute bottom-12 right-12 w-16 h-16 border-b-4 border-r-4 border-[#00FFCC]/40 rounded-br-3xl" />
                        </div>

                        {!isScanning && !isLoading && (
                            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md">
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Button onClick={() => setIsScanning(true)} className="h-24 px-16 rounded-full bg-[#00FFCC] text-black font-black text-2xl shadow-[0_0_50px_rgba(0,255,204,0.4)]">
                                        <Zap className="mr-3 fill-current" />
                                        START NEURAL SCAN
                                    </Button>
                                </motion.div>
                            </div>
                        )}
                    </div>

                    {/* Stats Panel */}
                    <div className="w-full md:w-96 bg-[#0A0A0A] p-12 border-l border-white/5 flex flex-col justify-between">
                        <div className="space-y-12">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-[#00FFCC]/10 flex items-center justify-center border border-[#00FFCC]/20">
                                    <Cpu className="text-[#00FFCC] w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-xl tracking-tighter">NEURAL CORE V2</h2>
                                    <p className="text-[10px] text-[#00FFCC] font-black uppercase tracking-[0.2em]">Expression Analysis</p>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <StatItem label="Signal Stream" value={isScanning ? 'ENCRYPTED' : 'OFFLINE'} active={isScanning} />
                                <StatItem label="Detected Aura" value={navigationTriggered.current ? 'LOCKED' : (detectedMood !== 'neutral' ? detectedMood : '---')} color={navigationTriggered.current ? '#00FFCC' : 'white'} />
                                
                                {isScanning && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-white/30 tracking-widest">
                                            <span>Accuracy Index</span>
                                            <span>{Math.round(confidence * 100)}%</span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div className="h-full bg-[#00FFCC]" animate={{ width: `${confidence * 100}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button onClick={onClose} className="w-full h-16 rounded-2xl bg-white/5 hover:bg-red-500/10 hover:text-red-500 text-white/40 font-black text-sm uppercase tracking-widest transition-all border border-white/5">
                            Abort Analysis
                        </button>
                    </div>

                    {/* Choice Dialog */}
                    <PlaylistChoiceDialog 
                        isOpen={showPlaylistChoice} 
                        onClose={() => setShowPlaylistChoice(false)}
                        onSelect={(choice) => { router.push(`/${choice}`); onClose(); }}
                        detectedMood={pendingNavigation as any}
                    />

                    {/* Global Exit */}
                    <button onClick={onClose} className="absolute top-10 right-10 p-4 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors z-[210]">
                        <X />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

function StatItem({ label, value, active = true, color = 'white' }: { label: string, value: string, active?: boolean, color?: string }) {
    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3">{label}</p>
            <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", active ? "bg-[#00FFCC] shadow-[0_0_10px_#00FFCC]" : "bg-white/10")} />
                <span className="text-2xl font-black uppercase tracking-tight" style={{ color }}>{value}</span>
            </div>
        </div>
    );
}
