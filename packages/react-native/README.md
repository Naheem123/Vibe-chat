# @noblesse/vibe-chat-native

Enterprise-ready AI Chat Widget and Screen View SDK for **React Native (iOS & Android)** with real-time SSE streaming, zero WebView overhead, configurable theming, user-isolated conversation history, and secure backend proxy support.

---

## Features

- **Native Primitives Only**: Zero WebView and zero DOM usage. 100% native views and smooth animations.
- **Dual Display Modes**:
  - `VibeChatNativeWidget` (or `<VibeChatWidget />`): Floating action launcher (FAB) expanding into a native slide modal.
  - `VibeChatView`: Embedded full-screen chat screen designed for **React Navigation** (`Stack.Screen`) or in-app tabs.
- **Configurable Theming**: Built-in support for the **Noblesse Tribe brand palette** (`blueDark`, `blueLight`, `green`, `white`, `black`) and dynamic host app theme overrides.
- **Multi-Account History Isolation**: Storage is automatically scoped to `userId`, preventing cross-account history leakage on shared devices and providing clean history purging on logout.
- **Resilient SSE Streaming**: Real-time token streaming from OpenRouter or custom endpoints with **`AbortController` cancellation** (Stop button) and **one-tap Retry** on network failure.
- **Safe Clipboard Handling**: Resilient clipboard helper compatible with modern React Native and community clipboard packages.
- **Enterprise Security**: Direct support for custom proxies (e.g. Noblesse Tribe's existing Go backend), eliminating the security risk of embedding shared OpenRouter keys in client binaries.

---

## Installation

```bash
# Using npm
npm install @noblesse/vibe-chat-native

# Using Yarn
yarn add @noblesse/vibe-chat-native
```

### Peer Dependencies

```bash
# Optional: Persist chat history across app restarts
npm install @react-native-async-storage/async-storage

# Optional: Safe message copying to clipboard
npm install @react-native-clipboard/clipboard
```

> **Note**: If `@react-native-async-storage/async-storage` is omitted, the SDK automatically degrades to memory storage without crashing.

---

## Quick Start (Noblesse Tribe)

### 1. Floating Widget Mode

```tsx
import React from 'react';
import { View } from 'react-native';
import { VibeChatNativeWidget } from '@noblesse/vibe-chat-native';

const brand = {
  blueDark: '#201E5A',
  blueLight: '#0AB1DE',
  green: '#01C542',
  white: '#FFFFFF',
  black: '#000000',
};

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      {/* Your Host App Content */}
      <VibeChatNativeWidget
        assistantName="Noblesse AI"
        userId="user_12345"
        openRouterKey="sk-or-..." // For development / user-supplied keys
        theme={{
          primary: brand.blueDark,
          secondary: brand.blueLight,
          accent: brand.green,
          background: brand.white,
          text: brand.black,
        }}
        suggestions={[
          '✨ What is Noblesse Tribe and how does it work?',
          '🧑‍💻 Help me integrate the React Native SDK',
          '🌍 How do we secure API keys in mobile apps?',
        ]}
      />
    </View>
  );
}
```

### 2. Embedded Screen Mode (React Navigation)

```tsx
import React from 'react';
import { VibeChatView, noblesseTribeTheme } from '@noblesse/vibe-chat-native';

export function ChatScreen({ navigation }: any) {
  return (
    <VibeChatView
      assistantName="Noblesse AI"
      userId="user_12345"
      theme={noblesseTribeTheme}
      onClose={() => navigation.goBack()}
    />
  );
}
```

---

## Theming & Branding

The SDK never requires modifying library source code to change appearance.

### Noblesse Tribe Palette Reference

```ts
import { NOBLESSE_BRAND } from '@noblesse/vibe-chat-native';

console.log(NOBLESSE_BRAND);
// {
//   blueDark: '#201E5A',
//   blueLight: '#0AB1DE',
//   green: '#01C542',
//   white: '#FFFFFF',
//   black: '#000000',
// }
```

### Configurable Theme Settings

| Setting | Type | Description |
| :--- | :--- | :--- |
| `primary` | `string` | Brand primary color (FAB, send button, user bubble) |
| `secondary` | `string` | Secondary accent (assistant avatar highlight, ring pulse) |
| `accent` | `string` | Status dot and action highlights |
| `background` | `string` | Base screen background color |
| `surface` | `string` | Header, cards, and input background |
| `text` | `string` | Main readable body text color |
| `textSecondary` | `string` | Subtitles, timestamps, and icons |
| `mode` | `'light' \| 'dark' \| 'auto'` | Appearance mode with accessible contrast defaults |
| `borderRadius` | `object` | Configurable corner radiuses (`sm`, `md`, `lg`, `bubble`) |
| `typography` | `object` | Font sizes, line heights, and custom font family |

---

## Multi-Account History & Security

### Account Isolation on Shared Devices

When multiple users share a mobile device, conversation history must never leak across logins. Pass the authenticated user's ID to `userId`:

```tsx
<VibeChatNativeWidget
  userId={currentSignedInUser.id}
  ...
/>
```

When `userId` changes, the SDK immediately switches the active storage namespace.

### Purging History on Logout

When a user signs out of Noblesse Tribe, purge their local conversation cache using the ref:

```tsx
const chatRef = useRef<VibeChatRef>(null);

const handleLogout = async () => {
  await chatRef.current?.clearHistory();
  await authService.signOut();
};
```

---

## Persistent Storage Across App Restarts

By default, without a storage adapter, the SDK retains history in-memory for the active session. To persist conversation history across mobile app restarts and cold boots, plug in `@react-native-async-storage/async-storage` using the provided `createAsyncStorageAdapter` helper:

```bash
npm install @react-native-async-storage/async-storage
# For iOS:
cd ios && pod install && cd ..
```

### Complete AsyncStorage Integration Example

```tsx
import React, { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VibeChatNativeWidget,
  createAsyncStorageAdapter,
  noblesseTribeTheme,
} from '@noblesse/vibe-chat-native';

export function NoblesseAIChat({ currentUserId }: { currentUserId: string }) {
  // Initialize the persistent adapter once
  const persistentStorage = useMemo(
    () => createAsyncStorageAdapter(AsyncStorage),
    []
  );

  return (
    <VibeChatNativeWidget
      assistantName="Noblesse AI"
      userId={currentUserId}
      storage={persistentStorage}
      theme={noblesseTribeTheme}
      endpoint="https://api.noblesse-tribe.com/v1/ai/chat"
    />
  );
}
```

The SDK automatically namespaces storage keys (`vibe_chat_user_{userId}_history`), ensuring that:
1. Messages persist when the user closes and reopens the app.
2. If another user signs in on the same physical phone, their conversation history remains completely isolated.
3. Rapid account switching will never write User A's messages into User B's storage namespace.

---

## Secure API Key & Backend Architecture

> [!WARNING]
> **Never embed a shared production OpenRouter API key in a distributed React Native binary** (`.env`, `react-native-config`, or JavaScript source). Any bundled key can easily be extracted by decompiling the APK or IPA.

### Recommended Production Architecture: Noblesse Tribe Go Backend Proxy

Instead of placing OpenRouter keys on mobile devices, route requests through Noblesse Tribe's existing Go backend:

```
Mobile App (React Native)
      │
      │  HTTPS POST with User Session JWT
      ▼
Noblesse Tribe Go Backend (Proxy / Usage Throttling)
      │
      │  Server-to-Server with private OPENROUTER_API_KEY
      ▼
OpenRouter API (SSE Token Streaming)
```

### SDK Integration with Go Backend Proxy

Simply supply the `endpoint` and host `headers` props:

```tsx
<VibeChatNativeWidget
  assistantName="Noblesse AI"
  endpoint="https://api.noblesse-tribe.com/v1/ai/chat"
  headers={{
    Authorization: `Bearer ${userSessionToken}`,
  }}
/>
```

### Sample Noblesse Tribe Go Backend Proxy Handler

```go
package main

import (
	"io"
	"net/http"
	"os"
)

func HandleAIChatProxy(w http.ResponseWriter, r *http.Request) {
	// 1. Authenticate Noblesse Tribe user session
	user := AuthenticateRequest(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 2. Prepare request to OpenRouter using private server-side key
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	proxyReq, err := http.NewRequestWithContext(r.Context(), "POST", "https://openrouter.ai/api/v1/chat/completions", r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	proxyReq.Header.Set("Authorization", "Bearer "+apiKey)
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("HTTP-Referer", "https://noblesse-tribe.com")
	proxyReq.Header.Set("X-Title", "Noblesse Tribe AI")

	// 3. Forward request and stream SSE response back to mobile app
	resp, err := http.DefaultClient.Do(proxyReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
```

---

## Data Privacy & Telemetry Disclosure

The SDK only transmits the following data to OpenRouter (or your designated backend proxy):
1. Selected model identifier (e.g. `google/gemini-2.5-flash`).
2. Recent conversation turns (`messages: [{ role, content }]`, capped to last 30 turns for token economy).
3. No device identifiers, biometric data, contacts, or location data are ever gathered or transmitted.

---

## Platform Notes & Build Verification

- **Hermes Engine**: Fully compatible with Hermes bytecode compilation on iOS and Android.
- **Safe Areas**: Handles status bar offsets natively on Android (`StatusBar.currentHeight`) and iOS edge-to-edge viewports.
- **Keyboard Behavior**: Uses `KeyboardAvoidingView` with platform-specific behavior (`padding` on iOS, layout resizing on Android).
- **Network Interruption**: Features retry action on failed bubbles and `AbortController` cancellation to prevent hanging sockets.

---

## License

This package is licensed under the **MIT License** with explicit commercial permission for use within Noblesse Tribe applications.
