import { Brain, Trash2, ChevronDown } from "lucide-react";
import { useState } from "react";

interface ChatHeaderProps {
  onClearChat?: () => void;
  onToggleSidebar?: () => void;
}

export default function ChatHeader({ onClearChat, onToggleSidebar }: ChatHeaderProps) {

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 bg-transparent sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 -ml-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Toggle Sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
        )}
        <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Brain size={18} className="text-indigo-500" />
          VibeChat
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onClearChat && (
          <button
            onClick={onClearChat}
            className="p-1.5 ml-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            title="Clear Chat"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
