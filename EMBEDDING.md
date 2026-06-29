# VibeChat Embedding Guide

This guide provides production-ready snippets to embed your VibeChat application into both standard websites and mobile applications (React Native).

Be sure to replace `https://your-live-domain.com` with your actual deployed Vercel URL.

---

## 1. Web Integration (HTML Iframe)

To embed the floating widget on a standard website, you need an iframe that covers the screen when opened, but allows clicks to pass through to your website when minimized. 

Because browsers block clicks to the underlying page if a full-screen iframe is present, you must use a small JavaScript snippet that listens for open/close events from VibeChat and adjusts the iframe's `pointer-events` dynamically.

**Requirements in VibeChat:**
To make this work perfectly, ensure your `ChatWrapper.tsx` sends a postMessage when opened or closed:
```javascript
// Add this inside your toggle function in VibeChat
window.parent.postMessage({ type: 'VIBE_CHAT_TOGGLE', isOpen: true }, '*');
```

**Snippet to place in your host website's `<body>`:**

```html
<!-- VibeChat Widget Container -->
<iframe 
  id="vibechat-iframe"
  src="https://your-live-domain.com"
  style="
    position: fixed;
    bottom: 0;
    right: 0;
    width: 100vw;
    height: 100vh;
    border: none;
    z-index: 999999;
    pointer-events: none; /* Mouse-transparent by default */
    background: transparent;
  "
  allow="microphone; camera; display-capture"
></iframe>

<script>
  // Dynamically manage mouse-transparency so users can interact with your 
  // website while the chat is minimized, but interact with the chat when opened.
  window.addEventListener('message', function(event) {
    // Optional: Verify event.origin here for security
    
    if (event.data && event.data.type === 'VIBE_CHAT_TOGGLE') {
      const iframe = document.getElementById('vibechat-iframe');
      if (event.data.isOpen) {
        // Chat is open: block clicks to website, allow interaction with chat
        iframe.style.pointerEvents = 'auto';
      } else {
        // Chat is closed: allow clicks to pass through to website
        iframe.style.pointerEvents = 'none';
      }
    }
  });

  // To allow clicking the floating bubble itself while the iframe is pointer-events: none,
  // we actually need to constrain the iframe size when closed.
  // Alternatively, inject the bubble directly in the parent DOM!
</script>
```

> **Note on pure CSS transparency:** If you want the iframe to be full-screen at all times, the only way to click the floating bubble while `pointer-events: none` is on the iframe is to physically resize the iframe to be e.g. `100px` by `100px` in the bottom right corner when closed, and `100vw` by `100vh` when opened, using the same `postMessage` event listener above.

---

## 2. Mobile Integration (React Native WebView)

To embed the chat seamlessly inside a React Native mobile application, you must use `react-native-webview` and explicitly grant hardware tokens for the microphone (for voice input) and the file system (for image attachments).

**Prerequisites:**
```bash
npm install react-native-webview
```
*Ensure you have added necessary `NSMicrophoneUsageDescription` and `NSPhotoLibraryUsageDescription` to your iOS `Info.plist`, and `RECORD_AUDIO` / `READ_EXTERNAL_STORAGE` to your Android `AndroidManifest.xml`.*

**React Native Snippet:**

```tsx
import React, { useRef } from 'react';
import { StyleSheet, View, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function VibeChatScreen() {
  const webViewRef = useRef<WebView>(null);

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://your-live-domain.com' }}
        style={styles.webview}
        
        // Essential hardware tokens & permissions
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        
        // Android specific: allows file system access for attachments
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        
        // Handle transparency and bouncing
        bounces={false}
        overScrollMode="never"
        backgroundColor="transparent"
        
        // Automatically grant microphone permissions without prompting every time (Android)
        onPermissionRequest={(request) => {
          request.grant();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9', // Matches your VibeChat background theme
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
```

### Why these props?
- `onPermissionRequest`: Automatically passes microphone tokens to the web layer on Android.
- `allowFileAccess`: Required for the paperclip attachment button to seamlessly open the native device camera roll / file picker.
- `allowsInlineMediaPlayback`: Ensures any generated audio or media plays seamlessly within the view without throwing the user into a full-screen native media player.
