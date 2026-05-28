'use client';

import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Sparkles, MessageSquare, Clock, User } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  role: 'user' | 'assistant';
  message: string;
  created_at: any;
}

export function AjjuDashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { firestore } = initializeFirebase();
    // Fetch all latest messages globally, ordered by newest first
    const messagesQuery = query(
      collection(firestore, 'whatsapp_conversations'),
      orderBy('created_at', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(loadedMessages);
      
      // Auto scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto h-[80vh] flex flex-col glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-emerald-500/10 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Header */}
      <div className="p-6 border-b border-white/5 backdrop-blur-md bg-black/20 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-[1px] shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-black/80 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">
              Ajju Neural Link
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live WhatsApp Sync
            </p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span>{messages.length} Intercepts</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Real-time</span>
          </div>
        </div>
      </div>

      {/* Message Feed */}
      <ScrollArea className="flex-1 p-6 z-10">
        <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-10">
          {messages.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <MessageSquare className="w-8 h-8 mb-4" />
              <p>Waiting for incoming signals...</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              
              return (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex flex-col max-w-[85%] animate-in slide-in-from-bottom-2 fade-in duration-300",
                    isAssistant ? "self-end items-end" : "self-start items-start"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2 px-1">
                    {!isAssistant && (
                      <>
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {msg.sender.replace('@c.us', '')}
                        </span>
                      </>
                    )}
                    {isAssistant && (
                      <span className="text-xs font-medium text-emerald-400">Ajju AI</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/50">
                      {msg.created_at?.toDate ? msg.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                    </span>
                  </div>
                  
                  <div 
                    className={cn(
                      "px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-lg backdrop-blur-md relative overflow-hidden",
                      isAssistant 
                        ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 text-emerald-50 rounded-tr-sm"
                        : "bg-white/5 border border-white/10 text-white/90 rounded-tl-sm"
                    )}
                  >
                    {/* Subtle internal glow for Ajju's messages */}
                    {isAssistant && (
                      <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />
                    )}
                    <span className="relative z-10 break-words">{msg.message}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} className="h-1" />
        </div>
      </ScrollArea>
    </div>
  );
}
