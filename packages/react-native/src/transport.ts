/**
 * @noblesse/vibe-chat-native
 * Resilient SSE streaming network engine supporting OpenRouter,
 * custom proxy endpoints (e.g. Noblesse Tribe Go backend), request cancellation,
 * true incremental streaming on React Native Hermes (via XHR / ReadableStream),
 * and provider-side SSE error handling.
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

export interface SSEEventResult {
  delta?: string;
  error?: string;
  isDone?: boolean;
}

/**
 * Parses Server-Sent Events (SSE) data lines safely.
 * Detects content deltas, provider error payloads, and completion signals.
 */
export function parseSSEEvent(line: string): SSEEventResult {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) {
    return {};
  }
  const dataContent = trimmed.slice(5).trim();
  if (dataContent === '[DONE]') {
    return { isDone: true };
  }

  try {
    const parsed = JSON.parse(dataContent);

    // 1. Detect provider-side error payload inside SSE event
    if (parsed.error) {
      const errMsg =
        typeof parsed.error === 'string'
          ? parsed.error
          : parsed.error.message || JSON.stringify(parsed.error);
      return { error: errMsg };
    }

    // 2. Check for finish_reason: error
    const choice = parsed.choices?.[0];
    if (choice?.finish_reason === 'error') {
      const finishErr = choice.error?.message || 'Model execution encountered an error.';
      return { error: finishErr };
    }

    // 3. Extract content delta
    const delta = choice?.delta?.content;
    if (typeof delta === 'string') {
      return { delta };
    }

    // Alternative format (text completion chunk)
    const text = choice?.text;
    if (typeof text === 'string') {
      return { delta: text };
    }
  } catch {
    // Malformed JSON or incomplete chunk — ignore safely to allow buffer assembly
  }
  return {};
}

/**
 * Backward-compatible helper. Throws if provider returned an in-stream error.
 */
export function parseSSELine(line: string): string | null {
  const res = parseSSEEvent(line);
  if (res.error) {
    throw new ChatNetworkError(`Provider error: ${res.error}`);
  }
  return res.delta ?? null;
}

/**
 * Genuine incremental SSE streaming using XMLHttpRequest.
 * Native standard on React Native (Hermes, iOS, Android).
 */
function streamViaXHR(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
  signal: AbortSignal | undefined,
  onChunk: (chunk: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XHR = (globalThis as any).XMLHttpRequest;
    if (!XHR) {
      reject(new ChatNetworkError('XMLHttpRequest is not available.'));
      return;
    }

    const xhr = new XHR();
    xhr.open('POST', url, true);

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    let seenIndex = 0;
    let fullResponse = '';
    let lineBuffer = '';
    let hasEncounteredError = false;

    const processIncrementalText = () => {
      const currentText: string = xhr.responseText || '';
      if (currentText.length > seenIndex) {
        const newChunk = currentText.slice(seenIndex);
        seenIndex = currentText.length;

        lineBuffer += newChunk;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const res = parseSSEEvent(line);
          if (res.error) {
            hasEncounteredError = true;
            try {
              xhr.abort();
            } catch {
              /* ignore */
            }
            reject(new ChatNetworkError(`Provider streaming error: ${res.error}`));
            return;
          }
          if (res.delta) {
            fullResponse += res.delta;
            onChunk(fullResponse);
          }
        }
      }
    };

    xhr.onprogress = () => {
      processIncrementalText();
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3) {
        processIncrementalText();
      } else if (xhr.readyState === 4) {
        if (hasEncounteredError) return;

        processIncrementalText();

        // Process any remainder in line buffer
        if (lineBuffer.trim()) {
          const res = parseSSEEvent(lineBuffer);
          if (res.error) {
            reject(new ChatNetworkError(`Provider streaming error: ${res.error}`));
            return;
          }
          if (res.delta) {
            fullResponse += res.delta;
            onChunk(fullResponse);
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          if (!fullResponse.trim()) {
            reject(
              new ChatNetworkError('Model stream ended without returning any content.')
            );
            return;
          }
          resolve(fullResponse);
        } else if (xhr.status === 0 && signal?.aborted) {
          reject(new ChatNetworkError('Request cancelled by user.', undefined, true));
        } else {
          let errDetail = xhr.responseText || `HTTP ${xhr.status}`;
          try {
            const parsed = JSON.parse(errDetail);
            errDetail = parsed.error?.message || parsed.message || errDetail;
          } catch {
            /* ignore */
          }
          reject(
            new ChatNetworkError(
              `Service returned error ${xhr.status}: ${errDetail.slice(0, 300)}`,
              xhr.status
            )
          );
        }
      }
    };

    xhr.onerror = () => {
      if (signal?.aborted) {
        reject(new ChatNetworkError('Request cancelled by user.', undefined, true));
      } else {
        reject(new ChatNetworkError('Network request failed. Please check your connection.'));
      }
    };

    xhr.ontimeout = () => {
      reject(new ChatNetworkError('Request timed out. Please try again.'));
    };

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new ChatNetworkError('Request cancelled by user.', undefined, true));
        return;
      }
      signal.addEventListener('abort', () => {
        try {
          xhr.abort();
        } catch {
          /* ignore */
        }
        reject(new ChatNetworkError('Request cancelled by user.', undefined, true));
      });
    }

    xhr.send(JSON.stringify(payload));
  });
}

/**
 * Incremental SSE streaming using WHATWG ReadableStream.
 * Used in environments where response.body.getReader() is supported.
 */
async function streamViaFetchReader(
  response: Response,
  signal: AbortSignal | undefined,
  onChunk: (chunk: string) => void
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reader = (response.body as any).getReader();
  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  let lineBuffer = '';
  let fullResponse = '';

  try {
    while (true) {
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        throw new ChatNetworkError('Streaming cancelled by user.', undefined, true);
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
        const res = parseSSEEvent(line);
        if (res.error) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          throw new ChatNetworkError(`Provider streaming error: ${res.error}`);
        }
        if (res.delta) {
          fullResponse += res.delta;
          onChunk(fullResponse);
        }
      }
    }

    // Process any remainder in line buffer
    if (lineBuffer.trim()) {
      const res = parseSSEEvent(lineBuffer);
      if (res.error) {
        throw new ChatNetworkError(`Provider streaming error: ${res.error}`);
      }
      if (res.delta) {
        fullResponse += res.delta;
        onChunk(fullResponse);
      }
    }

    if (!fullResponse.trim()) {
      throw new ChatNetworkError('Model stream ended without returning any content.');
    }

    return fullResponse;
  } catch (err: unknown) {
    if (signal?.aborted || (err as ChatNetworkError)?.isCancelled) {
      throw new ChatNetworkError('Streaming cancelled by user.', undefined, true);
    }
    throw err;
  }
}

/**
 * Detects whether the current runtime is React Native (Hermes, Old Arch, or New Arch).
 */
export function isReactNativeEnvironment(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  return (
    typeof g.HermesInternal !== 'undefined' ||
    (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') ||
    typeof g.nativeCallSyncHook !== 'undefined' ||
    typeof g.__fbBatchedBridge !== 'undefined' ||
    typeof g.RN$Bridgeless !== 'undefined'
  );
}

/**
 * Default OpenRouter / Custom Transport implementation.
 * Seamlessly selects between XMLHttpRequest (React Native Hermes iOS/Android) and
 * ReadableStream (Fetch API) for genuine real-time streaming without buffering.
 */
export const defaultOpenRouterTransport: ChatTransport = async (
  req: TransportRequest,
  onChunk: (chunk: string) => void
): Promise<string> => {
  const url = req.endpoint || DEFAULT_OPENROUTER_URL;
  const isDirectOpenRouter = url.includes('openrouter.ai');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasXHR = typeof (globalThis as any).XMLHttpRequest !== 'undefined';
  const isRN = isReactNativeEnvironment();

  // 1. In React Native Hermes (iOS & Android), global fetch lacks ReadableStream body reader.
  // Using XMLHttpRequest with onprogress provides genuine incremental token-by-token streaming.
  if (isRN && hasXHR) {
    return await streamViaXHR(url, headers, payload, req.signal, onChunk);
  }

  // 2. Fetch-based streaming flow
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
    // If fetch failed and XHR is available, try XHR
    if (hasXHR) {
      return await streamViaXHR(url, headers, payload, req.signal, onChunk);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = response.body as any;
  if (body && typeof body.getReader === 'function') {
    return await streamViaFetchReader(response, req.signal, onChunk);
  }

  // Fallback: If XHR is available, run via XHR for true streaming
  if (hasXHR) {
    return await streamViaXHR(url, headers, payload, req.signal, onChunk);
  }

  // Fallback: parse bulk text lines
  let fullResponse = '';
  const fullText = await response.text();
  for (const line of fullText.split('\n')) {
    const res = parseSSEEvent(line);
    if (res.error) {
      throw new ChatNetworkError(`Provider streaming error: ${res.error}`);
    }
    if (res.delta) {
      fullResponse += res.delta;
      onChunk(fullResponse);
    }
  }

  if (!fullResponse.trim()) {
    throw new ChatNetworkError('Model returned empty response.');
  }

  return fullResponse;
};
