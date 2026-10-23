/**
 * @noblesse/vibe-chat-native
 * Resilient SSE streaming network engine supporting OpenRouter,
 * custom proxy endpoints (e.g. Noblesse Tribe Go backend), request cancellation,
 * and chunked stream parsing.
 */

import { TransportRequest, ChatTransport } from './types';

export const DEFAULT_OPENROUTER_URL =
  'https://openrouter.ai/api/v1/chat/completions';

export class ChatNetworkError extends Error {
  status?: number;
  isCancelled?: boolean;

  constructor(message: string, status?: number, isCancelled: boolean = false) {
    super(message);
    this.name = 'ChatNetworkError';
    this.status = status;
    this.isCancelled = isCancelled;
  }
}

/**
 * Parses Server-Sent Events (SSE) data lines safely.
 */
export function parseSSELine(line: string): string | null {
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
  } catch {
    // Malformed JSON chunk or incomplete line; ignore safely
  }
  return null;
}

/**
 * Default OpenRouter transport implementation.
 */
export const defaultOpenRouterTransport: ChatTransport = async (
  req: TransportRequest,
  onChunk: (chunk: string) => void
): Promise<string> => {
  const url = req.endpoint || DEFAULT_OPENROUTER_URL;
  const isDirectOpenRouter = url.includes('openrouter.ai');

  const headers: Record<string, string> = {
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

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: req.signal,
    });
  } catch (err: unknown) {
    if (req.signal?.aborted) {
      throw new ChatNetworkError('Request cancelled by user.', undefined, true);
    }
    const message =
      err instanceof Error ? err.message : 'Network request failed';
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
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = `HTTP ${response.status}`;
      }
    }
    throw new ChatNetworkError(
      `Service returned error ${response.status}: ${errorDetail.slice(0, 300)}`,
      response.status
    );
  }

  let fullResponse = '';

  // Stream handling: Check for WHATWG ReadableStream
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = response.body as any;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const decoder =
      typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
    let lineBuffer = '';

    try {
      while (true) {
        if (req.signal?.aborted) {
          try {
            await reader.cancel();
          } catch {
            /* ignore reader cancel errors */
          }
          throw new ChatNetworkError(
            'Streaming cancelled by user.',
            undefined,
            true
          );
        }

        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = decoder
          ? decoder.decode(value, { stream: true })
          : String.fromCharCode.apply(null, Array.from(value as Uint8Array));

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
    } catch (err: unknown) {
      if (req.signal?.aborted || (err as ChatNetworkError)?.isCancelled) {
        throw new ChatNetworkError(
          'Streaming cancelled by user.',
          undefined,
          true
        );
      }
      throw err;
    }
  } else {
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
