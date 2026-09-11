import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle } from 'lucide-react';
import ChatApp from './chat/ChatApp';
import type { WidgetOptions } from '../types';
import styles from '../index.css?inline';

export interface VibeChatWidgetProps {
  options?: WidgetOptions;
}

export function VibeChatWidgetInner({ options }: VibeChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(options?.initialState === 'open');

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[999990] p-4 rounded-full shadow-xl transition-all hover:scale-110 active:scale-95 text-white flex items-center justify-center cursor-pointer border-none outline-none"
        style={{ 
          backgroundColor: options?.accentColor || '#3b82f6',
          pointerEvents: 'auto'
        }}
        aria-label="Open chat"
      >
        <MessageCircle size={32} />
      </button>
    );
  }

  return (
    <div 
      className="fixed inset-0 w-full h-[100dvh] z-[999999] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6 md:p-12 transition-all"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="bg-zinc-50 dark:bg-zinc-950 w-full h-full sm:max-w-6xl mx-auto sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        <ChatApp options={options} onClose={() => setIsOpen(false)} />
      </div>
    </div>
  );
}

export function VibeChatWidget({ options }: VibeChatWidgetProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  useLayoutEffect(() => {
    if (hostRef.current && !hostRef.current.shadowRoot) {
      const shadow = hostRef.current.attachShadow({ mode: 'open' });
      
      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      shadow.appendChild(styleEl);
      
      const rootEl = document.createElement('div');
      rootEl.id = 'react-root';
      rootEl.style.width = '100%';
      rootEl.style.height = '100%';
      shadow.appendChild(rootEl);
      
      setShadowRoot(shadow);
    }
  }, []);

  return (
    <div 
      ref={hostRef} 
      id="vibe-chat-root" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none', 
        zIndex: 999990 
      }}
    >
      {shadowRoot && createPortal(<VibeChatWidgetInner options={options} />, shadowRoot.getElementById('react-root')!)}
    </div>
  );
}
