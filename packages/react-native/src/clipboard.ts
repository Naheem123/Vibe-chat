/**
 * @noblesse/vibe-chat-native
 * Safe, backward-and-forward compatible clipboard adapter.
 * Handles RN deprecation of `Clipboard` without breaking apps.
 */

import { ClipboardAdapter } from './types';

export class SafeClipboard {
  private customAdapter?: ClipboardAdapter;

  constructor(customAdapter?: ClipboardAdapter) {
    this.customAdapter = customAdapter;
  }

  async setString(text: string): Promise<boolean> {
    if (this.customAdapter?.setString) {
      try {
        await this.customAdapter.setString(text);
        return true;
      } catch {
        /* ignore */
      }
    }

    // Try @react-native-clipboard/clipboard dynamic resolution
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const communityClipboard = require('@react-native-clipboard/clipboard');
      if (communityClipboard && typeof communityClipboard.setString === 'function') {
        communityClipboard.setString(text);
        return true;
      }
      if (communityClipboard?.default && typeof communityClipboard.default.setString === 'function') {
        communityClipboard.default.setString(text);
        return true;
      }
    } catch {
      // Community clipboard not installed; proceed to fallback
    }

    // Fallback to legacy React Native Clipboard if available in older RN versions
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const reactNative = require('react-native');
      if (reactNative?.Clipboard && typeof reactNative.Clipboard.setString === 'function') {
        reactNative.Clipboard.setString(text);
        return true;
      }
    } catch {
      // Legacy Clipboard not available
    }

    return false;
  }
}
