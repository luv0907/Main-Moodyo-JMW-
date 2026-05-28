import React from 'react';
import WhatsAppDashboard from '@/components/WhatsAppDashboard';

export const metadata = {
  title: 'WhatsApp Neural Link | MoodyO Admin',
  description: 'Live monitor for Ajju AI WhatsApp interactions',
};

export default function WhatsAppAdminPage() {
  return (
    <div className="w-full h-full bg-black">
      {/* Header */}
      <div className="h-16 bg-[#111b21] flex items-center px-6 border-b border-white/5">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center">
          <span className="mr-3 text-2xl">⚡</span>
          Neural Link Dashboard
        </h1>
        <div className="ml-auto flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-[#8696a0]">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <span>Ghost Engine v2 Active</span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Component */}
      <WhatsAppDashboard />
    </div>
  );
}
