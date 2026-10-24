/**
 * @noblesse/vibe-chat-native
 * Resilient SSE streaming network engine supporting OpenRouter,
 * custom proxy endpoints (e.g. Noblesse Tribe Go backend), request cancellation,
 * true incremental streaming on React Native Hermes (via XHR / ReadableStream),
 * and provider-side SSE error handling.
 */
import { ChatTransport } from './types';
export declare const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export declare class ChatNetworkError extends Error {
    status?: number;
    isCancelled?: boolean;
    constructor(message: string, status?: number, isCancelled?: boolean);
}
export interface SSEEventResult {
    delta?: string;
    error?: string;
    isDone?: boolean;
}
/**
 * Parses Server-Sent Events (SSE) data lines safely.
 * Detects content deltas, provider error payloads, and completion signals.
 */
export declare function parseSSEEvent(line: string): SSEEventResult;
/**
 * Backward-compatible helper. Throws if provider returned an in-stream error.
 */
export declare function parseSSELine(line: string): string | null;
/**
 * Detects whether the current runtime is React Native (Hermes, Old Arch, or New Arch).
 */
export declare function isReactNativeEnvironment(): boolean;
/**
 * Default OpenRouter / Custom Transport implementation.
 * Seamlessly selects between XMLHttpRequest (React Native Hermes iOS/Android) and
 * ReadableStream (Fetch API) for genuine real-time streaming without buffering.
 */
export declare const defaultOpenRouterTransport: ChatTransport;
//# sourceMappingURL=transport.d.ts.map