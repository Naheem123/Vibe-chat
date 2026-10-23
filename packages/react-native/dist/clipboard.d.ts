/**
 * @noblesse/vibe-chat-native
 * Safe, backward-and-forward compatible clipboard adapter.
 * Handles RN deprecation of `Clipboard` without breaking apps.
 */
import { ClipboardAdapter } from './types';
export declare class SafeClipboard {
    private customAdapter?;
    constructor(customAdapter?: ClipboardAdapter);
    setString(text: string): Promise<boolean>;
}
//# sourceMappingURL=clipboard.d.ts.map