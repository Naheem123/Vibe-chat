import { MessageSquare, Plus, Pin } from "lucide-react";
import { Conversation } from "./ChatApp";
import { useState, useRef, useEffect } from "react";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void;
  isOpen: boolean;
  onClose?: () => void;
}

export default function Sidebar({ conversations, activeId, onSelect, onNewChat, onDelete, onRename, onTogglePin, isOpen, onClose }: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; chatId: string | null }>({
    isOpen: false,
    x: 0,
    y: 0,
    chatId: null,
  });

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const touchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.isOpen) {
        setContextMenu({ ...contextMenu, isOpen: false });
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [contextMenu.isOpen, contextMenu]);

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, chatId: string, x?: number, y?: number) => {
    e.preventDefault();
    if (touchTimeout.current) clearTimeout(touchTimeout.current);
    
    let clientX = x;
    let clientY = y;
    
    if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    setContextMenu({
      isOpen: true,
      x: clientX || 0,
      y: clientY || 0,
      chatId,
    });
  };

  const handleTouchStart = (e: React.TouchEvent, chatId: string) => {
    const touch = e.touches[0];
    touchTimeout.current = setTimeout(() => {
      handleContextMenu(e, chatId, touch.clientX, touch.clientY);
    }, 500);
  };

  const handleTouchEndOrMove = () => {
    if (touchTimeout.current) clearTimeout(touchTimeout.current);
  };

  const pinnedChats = conversations.filter((c) => c.isPinned);
  const recentChats = conversations.filter((c) => !c.isPinned);

  const renderChatItem = (chat: Conversation) => (
    <div
      key={chat.id}
      onClick={() => {
        if (editingChatId !== chat.id) {
          onSelect(chat.id);
          onClose?.();
        }
      }}
      onContextMenu={(e) => handleContextMenu(e, chat.id)}
      onTouchStart={(e) => handleTouchStart(e, chat.id)}
      onTouchEnd={handleTouchEndOrMove}
      onTouchMove={handleTouchEndOrMove}
      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 group select-none ${
        activeId === chat.id 
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium" 
          : "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 text-zinc-600 dark:text-zinc-400"
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden w-full">
        {chat.isPinned ? (
          <Pin size={14} className="shrink-0 text-zinc-500 dark:text-zinc-400 fill-zinc-500 dark:fill-zinc-400" />
        ) : (
          <MessageSquare size={14} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
        )}
        
        {editingChatId === chat.id ? (
          <input 
            autoFocus
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => {
              if (editTitle.trim()) onRename(chat.id, editTitle);
              setEditingChatId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (editTitle.trim()) onRename(chat.id, editTitle);
                setEditingChatId(null);
              }
            }}
            className="bg-transparent border-b border-zinc-500 outline-none text-sm font-medium w-full text-zinc-900 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate text-[13px] opacity-90">{chat.title}</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-30 transition-opacity" 
          onClick={onClose}
        />
      )}
      
      <div 
        className={`absolute md:relative z-40 h-full w-[80vw] max-w-[320px] md:w-[260px] bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 flex flex-col shrink-0 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4">
          <button
            onClick={() => {
              onNewChat();
              onClose?.();
            }}
            className="h-9 w-full flex items-center justify-between rounded-lg border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 px-3 text-[13px] text-zinc-700 dark:text-zinc-300 transition-all font-medium"
          >
            <span>New Chat</span>
            <Plus size={14} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 space-y-4 pb-4 custom-scrollbar">
          {pinnedChats.length > 0 && (
            <div className="space-y-1">
              <h3 className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Pinned</h3>
              {pinnedChats.map(renderChatItem)}
            </div>
          )}

          {recentChats.length > 0 && (
            <div className="space-y-1">
              <h3 className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Recent</h3>
              {recentChats.map(renderChatItem)}
            </div>
          )}
        </div>
      </div>

      {contextMenu.isOpen && contextMenu.chatId && (
        <div 
          className="fixed z-50 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden text-sm"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 150), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
        >
          <button 
            className="w-full text-left px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 text-zinc-700 dark:text-zinc-300"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(contextMenu.chatId!);
              setContextMenu({ ...contextMenu, isOpen: false });
            }}
          >
            <span>📌</span> {conversations.find(c => c.id === contextMenu.chatId)?.isPinned ? "Unpin" : "Pin"}
          </button>
          <button 
            className="w-full text-left px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800/50 flex items-center gap-3 text-zinc-700 dark:text-zinc-300"
            onClick={(e) => {
              e.stopPropagation();
              setEditTitle(conversations.find(c => c.id === contextMenu.chatId)?.title || "");
              setEditingChatId(contextMenu.chatId);
              setContextMenu({ ...contextMenu, isOpen: false });
            }}
          >
            <span>✏️</span> Rename
          </button>
          <button 
            className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors border-t border-zinc-100 dark:border-zinc-800/50 flex items-center gap-3"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(contextMenu.chatId!);
              setContextMenu({ ...contextMenu, isOpen: false });
            }}
          >
            <span>🗑️</span> Delete
          </button>
        </div>
      )}
    </>
  );
}
