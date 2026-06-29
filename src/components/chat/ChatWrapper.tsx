"use client";

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import ChatApp from "./ChatApp";

export default function ChatWrapper() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button - Closed State */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-tr from-indigo-600 to-purple-600 hover:scale-110 transition-transform duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] rounded-full text-white"
          aria-label="Open Chat"
        >
          <MessageSquare size={28} />
        </button>
      )}

      {/* Immersive Expansion - Open State */}
      {isChatOpen && (
        <div className="fixed inset-0 w-full h-full z-50 bg-white dark:bg-slate-950 flex flex-col animate-in fade-in duration-200">
          {/* Header area with close button (positioned over the ChatApp layout) */}
          <button
            onClick={() => setIsChatOpen(false)}
            className="absolute top-3 right-4 z-[60] p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors backdrop-blur-sm"
            aria-label="Close Chat"
          >
            <X size={20} />
          </button>
          
          <div className="flex-1 w-full h-full relative overflow-hidden">
            <ChatApp />
          </div>
        </div>
      )}
    </>
  );
}
