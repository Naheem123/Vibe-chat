"use strict";
/**
 * @noblesse/vibe-chat-native
 * Resilient SSE streaming network engine supporting OpenRouter,
 * custom proxy endpoints (e.g. Noblesse Tribe Go backend), request cancellation,
 * and chunked stream parsing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultOpenRouterTransport = exports.ChatNetworkError = exports.DEFAULT_OPENROUTER_URL = void 0;
exports.parseSSELine = parseSSELine;
exports.DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
class ChatNetworkError extends Error {
    constructor(message, status, isCancelled = false) {
        super(message);
        this.name = 'ChatNetworkError';
        this.status = status;
        this.isCancelled = isCancelled;
    }
}
exports.ChatNetworkError = ChatNetworkError;
/**
 * Parses Server-Sent Events (SSE) data lines safely.
 */
function parseSSELine(line) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) {
        return null;
    }
    const dataContent = trimmed.slice(5).trim();
    if (dataContent === '[DONE]') {
        return null;
    }
    try {
        const parsed = JSON.parse(dataContent);
        // OpenRouter / OpenAI standard delta content
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') {
            return delta;
        }
        // Alternative format (full message completion chunk)
        const text = parsed.choices?.[0]?.text;
        if (typeof text === 'string') {
            return text;
        }
    }
    catch {
        // Malformed JSON chunk or incomplete line; ignore safely
    }
    return null;
}
/**
 * Default OpenRouter transport implementation.
 */
const defaultOpenRouterTransport = async (req, onChunk) => {
    const url = req.endpoint || exports.DEFAULT_OPENROUTER_URL;
    const isDirectOpenRouter = url.includes('openrouter.ai');
    const headers = {
        'Content-Type': 'application/json',
        ...(req.headers || {}),
    };
    if (req.apiKey) {
        headers['Authorization'] = `Bearer ${req.apiKey.trim()}`;
    }
    if (isDirectOpenRouter) {
        headers['HTTP-Referer'] = 'https://noblesse-tribe.com';
        headers['X-Title'] = 'Noblesse Tribe AI';
    }
    const payload = {
        model: req.model,
        messages: req.messages,
        stream: req.stream !== false,
    };
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: req.signal,
        });
    }
    catch (err) {
        if (req.signal?.aborted) {
            throw new ChatNetworkError('Request cancelled by user.', undefined, true);
        }
        const message = err instanceof Error ? err.message : 'Network request failed';
        throw new ChatNetworkError(message);
    }
    if (!response.ok) {
        let errorDetail = '';
        try {
            const errorJson = await response.json();
            errorDetail =
                errorJson.error?.message ||
                    errorJson.message ||
                    JSON.stringify(errorJson);
        }
        catch {
            try {
                errorDetail = await response.text();
            }
            catch {
                errorDetail = `HTTP ${response.status}`;
            }
        }
        throw new ChatNetworkError(`Service returned error ${response.status}: ${errorDetail.slice(0, 300)}`, response.status);
    }
    let fullResponse = '';
    // Stream handling: Check for WHATWG ReadableStream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = response.body;
    if (body && typeof body.getReader === 'function') {
        const reader = body.getReader();
        const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
        let lineBuffer = '';
        try {
            while (true) {
                if (req.signal?.aborted) {
                    try {
                        await reader.cancel();
                    }
                    catch {
                        /* ignore reader cancel errors */
                    }
                    throw new ChatNetworkError('Streaming cancelled by user.', undefined, true);
                }
                const { done, value } = await reader.read();
                if (done)
                    break;
                const textChunk = decoder
                    ? decoder.decode(value, { stream: true })
                    : String.fromCharCode.apply(null, Array.from(value));
                lineBuffer += textChunk;
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() ?? '';
                for (const line of lines) {
                    const delta = parseSSELine(line);
                    if (delta) {
                        fullResponse += delta;
                        onChunk(fullResponse);
                    }
                }
            }
            // Process any remainder
            if (lineBuffer.trim()) {
                const delta = parseSSELine(lineBuffer);
                if (delta) {
                    fullResponse += delta;
                    onChunk(fullResponse);
                }
            }
        }
        catch (err) {
            if (req.signal?.aborted || err?.isCancelled) {
                throw new ChatNetworkError('Streaming cancelled by user.', undefined, true);
            }
            throw err;
        }
    }
    else {
        // Fallback for React Native environments without response.body streaming reader
        const fullText = await response.text();
        for (const line of fullText.split('\n')) {
            const delta = parseSSELine(line);
            if (delta) {
                fullResponse += delta;
                onChunk(fullResponse);
            }
        }
    }
    return fullResponse;
};
exports.defaultOpenRouterTransport = defaultOpenRouterTransport;
//# sourceMappingURL=transport.js.map