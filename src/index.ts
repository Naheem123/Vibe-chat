import React from 'react';
import { createRoot } from 'react-dom/client';
import { VibeChatWidget } from './components/VibeChatWidget';
import type { WidgetOptions } from './types';

// React component export
export { VibeChatWidget, type WidgetOptions };

// Standalone initialization
export const init = (options: WidgetOptions) => {
  let rootNode = document.getElementById('vibe-chat-vanilla-root');
  if (!rootNode) {
    rootNode = document.createElement('div');
    rootNode.id = 'vibe-chat-vanilla-root';
    document.body.appendChild(rootNode);
  }

  const root = createRoot(rootNode);
  root.render(React.createElement(VibeChatWidget, { options }));
};

// Global API
if (typeof window !== 'undefined') {
  (window as any).VibeChatWidget = { init };
}
