/**
 * @noblesse/vibe-chat-native
 * Resilient SSE streaming network engine supporting OpenRouter,
 * custom proxy endpoints (e.g. Noblesse Tribe Go backend), request cancellation,
 * and chunked stream parsing.
 */
import { ChatTransport } from './types';
export declare const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export declare class ChatNetworkError extends Error {
    status?: number;
    isCancelled?: boolean;
    constructor(message: string, status?: number, isCancelled?: boolean);
}
/**
 * Parses Server-Sent Events (SSE) data lines safely.
 */
export declare function parseSSELine(line: string): string | null;
/**
 * Default OpenRouter transport implementation.
 */
export declare const defaultOpenRouterTransport: ChatTransport;
//# sourceMappingURL=transport.d.ts.map