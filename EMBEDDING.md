# VibeChat Embedding Guide

This guide provides production-ready snippets to embed your VibeChat application into standard websites as a vanilla script, or into React applications as a native component.

The Widget SDK is zero-dependency and safely encapsulates all styles within a Shadow DOM, guaranteeing it won't conflict with your host application's CSS.

---

## 1. Web Integration (Vanilla HTML)

To embed the floating widget on a standard website, simply include the compiled script bundle and initialize it. 

The widget will dynamically append itself to the `<body>`, rendering a floating action button in the bottom right corner that expands into a full-screen chat interface.

**Snippet to place in your host website's `<body>`:**

```html
<!-- Load the standalone script bundle -->
<script src="https://your-domain.com/dist/vibe-chat-widget.js"></script>

<!-- Initialize the widget -->
<script>
  VibeChatWidget.init({
    openRouterKey: "YOUR_API_KEY_HERE",
    defaultModel: "openai/gpt-4o",
    accentColor: "#4B1F3F",
    initialState: "closed" // or "open"
  });
</script>
```

---

## 2. React Integration (Component Export)

To embed the chat seamlessly inside a React application, you can import the typed component directly. It manages its own internal open/close state and expands natively over your app's current route.

**React App Setup:**

```tsx
import React from 'react';
import { VibeChatWidget } from 'vibe-chat-sdk'; // Or relative path if importing locally

export default function App() {
  return (
    <div>
      {/* Your application content goes here */}
      <h1>My Application</h1>
      
      {/* Drop the widget into your root layout */}
      <VibeChatWidget 
        options={{
          openRouterKey: "YOUR_API_KEY_HERE",
          defaultModel: "openai/gpt-4o",
          accentColor: "#4B1F3F",
          initialState: "closed"
        }} 
      />
    </div>
  );
}
```

### Configuration Options
Both the `VibeChatWidget.init()` method and the `<VibeChatWidget />` component accept the same configuration options:

- `openRouterKey` (string): Your API key for routing requests to OpenRouter.
- `defaultModel` (string): The default LLM model to use (e.g., `openai/gpt-4o`, `google/gemini-2.5-flash`).
- `accentColor` (string): A CSS color string (hex, rgb) to customize the floating bubble and primary buttons.
- `initialState` (`"open" | "closed"`): Whether the widget should spawn opened or collapsed to the floating button.
