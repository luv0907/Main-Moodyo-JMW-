'use client';

import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

interface Message {
  id: string;
  sender: string;
  role: 'user' | 'assistant';
  message: string;
  created_at: any;
}

interface Profile {
  sender: string;
  name: string;
  msg_count: number;
  last_seen: any;
}

export default function WhatsAppDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load Profiles
  useEffect(() => {
    const { firestore } = initializeFirebase();
    const profilesQuery = query(collection(firestore, 'whatsapp_profiles'), orderBy('last_seen', 'desc'));
    
    const unsubscribe = onSnapshot(profilesQuery, (snapshot) => {
      const loadedProfiles = snapshot.docs.map(doc => ({
        sender: doc.id,
        ...doc.data()
      })) as Profile[];
      setProfiles(loadedProfiles);
      if (!selectedSender && loadedProfiles.length > 0) {
        setSelectedSender(loadedProfiles[0].sender);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load Messages for selected profile
  useEffect(() => {
    if (!selectedSender) return;

    const { firestore } = initializeFirebase();
    const messagesQuery = query(
      collection(firestore, 'whatsapp_conversations'),
      where('sender', '==', selectedSender),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(loadedMessages);
    });

    return () => unsubscribe();
  }, [selectedSender]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-[#111b21] overflow-hidden font-sans border-t border-white/5">
      
      {/* Sidebar - Profiles */}
      <div className="w-1/3 min-w-[300px] max-w-[400px] bg-[#111b21] border-r border-[#222d34] flex flex-col">
        <div className="h-16 bg-[#202c33] flex items-center px-4 shrink-0 shadow-sm z-10">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <span className="text-emerald-500 text-lg">🩺</span>
          </div>
          <h2 className="text-[#e9edef] font-semibold text-lg ml-4 tracking-tight">Ajju Live Desk</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#374045] scrollbar-track-transparent">
          {profiles.map(profile => (
            <button
              key={profile.sender}
              onClick={() => setSelectedSender(profile.sender)}
              className={`w-full flex items-center px-3 py-3 border-b border-[#222d34] transition-colors duration-150 ${
                selectedSender === profile.sender ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-white font-bold text-lg">{profile.name?.charAt(0) || '?'}</span>
              </div>
              <div className="ml-4 flex-1 text-left min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-[#e9edef] font-medium text-base truncate">{profile.name}</h3>
                  <span className="text-[#8696a0] text-xs shrink-0 ml-2">
                    {profile.last_seen?.toDate ? profile.last_seen.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[#8696a0] text-sm truncate pr-2">{profile.sender}</p>
                  <span className="bg-emerald-500 text-[#111b21] text-xs font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm">
                    {profile.msg_count}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {profiles.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[#8696a0] opacity-70 p-6 text-center">
              <span className="text-4xl mb-3">📱</span>
              <p>Waiting for incoming WhatsApp messages...</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0b141a] relative">
        {/* Chat Background Pattern */}
        <div className="absolute inset-0 opacity-[0.06] bg-[url('https://static.whatsapp.net/rsrc.php/v3/yl/r/r_QMeDBCPvw.png')] pointer-events-none" />
        
        {selectedSender ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-[#202c33] flex items-center px-4 shrink-0 shadow-sm z-10 sticky top-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold">{profiles.find(p => p.sender === selectedSender)?.name?.charAt(0) || '?'}</span>
              </div>
              <div className="ml-4">
                <h2 className="text-[#e9edef] font-medium text-base">{profiles.find(p => p.sender === selectedSender)?.name}</h2>
                <p className="text-[#8696a0] text-xs mt-0.5">{selectedSender}</p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-16 py-6 scrollbar-thin scrollbar-thumb-[#374045] scrollbar-track-transparent">
              <div className="flex flex-col space-y-3 max-w-4xl mx-auto">
                {/* Date Bubble (Simulated) */}
                {messages.length > 0 && (
                  <div className="flex justify-center mb-6 mt-2">
                    <span className="bg-[#182229] text-[#8696a0] text-xs uppercase px-4 py-1.5 rounded-lg shadow-sm font-medium tracking-wider">
                      Conversation History
                    </span>
                  </div>
                )}
                
                {messages.map((msg, index) => {
                  const isAssistant = msg.role === 'assistant';
                  
                  return (
                    <div 
                      key={msg.id || index} 
                      className={`flex w-full ${isAssistant ? 'justify-start' : 'justify-end'}`}
                    >
                      <div 
                        className={`max-w-[70%] rounded-lg px-3 pb-2 pt-2 shadow-sm relative group ${
                          isAssistant 
                            ? 'bg-[#202c33] text-[#e9edef] rounded-tl-none' 
                            : 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                        }`}
                      >
                        {/* Little triangle tail for visual accuracy */}
                        <div className={`absolute top-0 w-3 h-3 ${isAssistant ? '-left-3 text-[#202c33]' : '-right-3 text-[#005c4b]'}`}>
                          <svg viewBox="0 0 8 13" width="8" height="13" className="fill-current">
                            <path opacity=".13" fill="#0000000" d={isAssistant ? "M1.533 3.118L8 20.118V0L1.533 3.118z" : "M5.188 1L0 20.118V0l5.188 1z"}></path>
                            <path fill="currentColor" d={isAssistant ? "M1.533 2.118L8 19.118V0L1.533 2.118z" : "M5.188 0L0 19.118V0l5.188 0z"}></path>
                          </svg>
                        </div>

                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap pr-8 break-words font-normal">
                          {msg.message}
                        </div>
                        <div className="text-[11px] text-[#8696a0] float-right mt-1 ml-4 -mr-1 flex items-center h-[15px]">
                          {msg.created_at?.toDate ? msg.created_at.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                          {!isAssistant && (
                            <span className="ml-1 text-[#53bdeb] scale-110">
                              ✓✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>
            
            {/* Footer / Input Area */}
            <div className="h-16 bg-[#202c33] px-4 flex items-center shrink-0 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.1)]">
               <div className="w-full bg-[#2a3942] rounded-lg px-4 py-3 flex items-center">
                 <p className="text-[#8696a0] text-[15px]">Dr. Ajju is actively handling this conversation...</p>
                 <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 z-10">
            <div className="w-64 h-64 mb-8 bg-[#202c33] rounded-full flex items-center justify-center shadow-lg border border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <span className="text-8xl transform group-hover:scale-110 transition-transform duration-500 ease-out drop-shadow-2xl">🤖</span>
            </div>
            <h1 className="text-4xl text-[#e9edef] font-light mb-4 tracking-tight">MoodyO WhatsApp Link</h1>
            <p className="text-[#8696a0] max-w-md text-[15px] leading-relaxed">
              Real-time synchronization active. Select a patient from the sidebar to view their conversation history with Ajju.
            </p>
            <div className="mt-10 px-6 py-2 bg-[#202c33] rounded-full border border-emerald-500/30 flex items-center shadow-lg shadow-emerald-500/5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)] mr-3"></div>
              <span className="text-[#8696a0] text-sm font-medium tracking-wide">SYSTEM ONLINE</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
