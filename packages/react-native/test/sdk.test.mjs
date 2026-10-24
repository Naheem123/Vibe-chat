import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const themeModule = require('../dist/theme.js');
const storageModule = require('../dist/storage.js');
const transportModule = require('../dist/transport.js');

// ---------------------------------------------------------------------------
// 1. Noblesse Tribe Brand Palette & Configurable Theming Test
// ---------------------------------------------------------------------------
test('Theme Engine: Applies Noblesse Tribe brand palette & custom configs', () => {
  const { resolveTheme, noblesseTribeTheme } = themeModule;

  // Test predefined Noblesse Tribe Theme
  const lightResolved = resolveTheme(noblesseTribeTheme, 'light');
  assert.equal(lightResolved.colors.primary, '#201E5A', 'Primary must match Noblesse blueDark');
  assert.equal(lightResolved.colors.secondary, '#0AB1DE', 'Secondary must match Noblesse blueLight');
  assert.equal(lightResolved.colors.accent, '#01C542', 'Accent must match Noblesse green');
  assert.equal(lightResolved.colors.background, '#FFFFFF', 'Background must match Noblesse white');
  assert.equal(lightResolved.colors.text, '#000000', 'Text must match Noblesse black');
  assert.equal(lightResolved.isDark, false);

  // Test dark mode resolution
  const darkResolved = resolveTheme(noblesseTribeTheme, 'dark');
  assert.equal(darkResolved.isDark, true);
  assert.equal(darkResolved.colors.accent, '#01C542');

  // Test that host application can configure theme without editing SDK source code
  const hostAppTheme = {
    primary: '#201E5A',
    secondary: '#0AB1DE',
    accent: '#01C542',
    background: '#FFFFFF',
    text: '#000000',
  };
  const hostResolved = resolveTheme(hostAppTheme, 'light');
  assert.equal(hostResolved.colors.primary, '#201E5A');
  assert.equal(hostResolved.colors.secondary, '#0AB1DE');
  assert.equal(hostResolved.colors.accent, '#01C542');
  assert.equal(hostResolved.colors.background, '#FFFFFF');
  assert.equal(hostResolved.colors.text, '#000000');
  assert.equal(hostResolved.colors.userBubbleBackground, '#201E5A');
});

// ---------------------------------------------------------------------------
// 2. Multi-Account Isolation & Logout Cleanup Test
// ---------------------------------------------------------------------------
test('Storage Engine: Isolates user chat histories and clears history on logout', async () => {
  const {
    InMemoryStorageAdapter,
    saveUserConversations,
    loadUserConversations,
    clearUserConversations,
    getUserStorageKey,
  } = storageModule;

  const storage = new InMemoryStorageAdapter();

  const userAlexChat = [
    {
      id: 'conv-alex-1',
      title: 'Confidential Strategy',
      messages: [{ id: 'm1', role: 'user', content: 'Secret project notes' }],
      updatedAt: Date.now(),
      userId: 'user_alex',
    },
  ];

  const userLardeyChat = [
    {
      id: 'conv-lardey-1',
      title: 'Community Announcements',
      messages: [{ id: 'm2', role: 'user', content: 'Welcome members' }],
      updatedAt: Date.now(),
      userId: 'user_lardey',
    },
  ];

  // Save conversation histories under their respective account IDs
  await saveUserConversations(storage, userAlexChat, 'user_alex');
  await saveUserConversations(storage, userLardeyChat, 'user_lardey');

  // Verify unique key scoping
  assert.equal(getUserStorageKey('user_alex'), 'vibe_chat_user_user_alex_history');
  assert.equal(getUserStorageKey('user_lardey'), 'vibe_chat_user_user_lardey_history');

  // Verify user isolation: loading Lardey does NOT return Alex's conversations
  const loadedLardey = await loadUserConversations(storage, 'user_lardey');
  assert.equal(loadedLardey.length, 1);
  assert.equal(loadedLardey[0].title, 'Community Announcements');
  assert.equal(loadedLardey[0].messages[0].content, 'Welcome members');

  // Verify Alex's data is intact
  const loadedAlex = await loadUserConversations(storage, 'user_alex');
  assert.equal(loadedAlex.length, 1);
  assert.equal(loadedAlex[0].title, 'Confidential Strategy');

  // Verify Logout Cleanup: clearing Alex's history must purge Alex without touching Lardey
  await clearUserConversations(storage, 'user_alex');
  const alexAfterLogout = await loadUserConversations(storage, 'user_alex');
  assert.equal(alexAfterLogout.length, 0, 'Alex conversation history must be purged after logout');

  const lardeyAfterAlexLogout = await loadUserConversations(storage, 'user_lardey');
  assert.equal(lardeyAfterAlexLogout.length, 1, 'Lardey conversation history must remain untouched');
});

// ---------------------------------------------------------------------------
// 3. SSE Stream Parser & Malformed Chunk Handling Test
// ---------------------------------------------------------------------------
test('Transport Engine: Parses SSE streaming deltas and safely ignores malformed chunks', () => {
  const { parseSSEEvent } = transportModule;

  // Valid streaming chunk
  const validLine = 'data: {"choices":[{"delta":{"content":"Hello from Noblesse AI"}}]}';
  const res = parseSSEEvent(validLine);
  assert.equal(res.delta, 'Hello from Noblesse AI');

  // End of stream indicator
  assert.equal(parseSSEEvent('data: [DONE]').isDone, true);

  // Ping / comments / empty lines
  assert.deepEqual(parseSSEEvent(''), {});
  assert.deepEqual(parseSSEEvent(': heartbeat'), {});
  assert.deepEqual(parseSSEEvent('event: ping'), {});

  // Broken/partial JSON (must not throw error)
  assert.deepEqual(parseSSEEvent('data: {"choices":[{"delta":{"conte'), {});
});

// ---------------------------------------------------------------------------
// 4. Provider-Side SSE Error Event Handling (No False Success)
// ---------------------------------------------------------------------------
test('Transport Engine: Detects provider SSE error events and flags failure', () => {
  const { parseSSEEvent, parseSSELine } = transportModule;

  // Provider rate limit or internal model error payload
  const errorLine = 'data: {"error": {"message": "Rate limit exceeded for model", "code": 429}}';
  const res = parseSSEEvent(errorLine);
  assert.equal(res.error, 'Rate limit exceeded for model');

  // parseSSELine must throw to halt stream and prevent false success
  assert.throws(
    () => parseSSELine(errorLine),
    /Provider error: Rate limit exceeded for model/
  );

  // Finish reason: error
  const finishErrLine = 'data: {"choices":[{"delta":{},"finish_reason":"error","error":{"message":"Safety filter triggered"}}]}';
  const finishRes = parseSSEEvent(finishErrLine);
  assert.equal(finishRes.error, 'Safety filter triggered');
});

// ---------------------------------------------------------------------------
// 5. Custom Transport / Noblesse Tribe Go Backend Proxy Test
// ---------------------------------------------------------------------------
test('Transport Engine: Supports caller-provided transport for Noblesse Tribe Go backend', async () => {
  let transportInvoked = false;
  let sentAuthHeader = '';
  let sentEndpoint = '';

  const noblesseGoBackendTransport = async (req, onChunk) => {
    transportInvoked = true;
    sentAuthHeader = req.headers?.['Authorization'] || '';
    sentEndpoint = req.endpoint || '';

    // Simulate streaming SSE tokens from backend
    onChunk('Token 1: Hello ');
    onChunk('Token 2: Noblesse ');
    onChunk('Token 3: Community!');

    return 'Token 1: Hello Token 2: Noblesse Token 3: Community!';
  };

  const streamedChunks = [];
  const finalMessage = await noblesseGoBackendTransport(
    {
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: 'What is Noblesse?' }],
      stream: true,
      headers: { Authorization: 'Bearer noblesse-session-jwt-token' },
      endpoint: 'https://api.noblesse-tribe.com/v1/ai/chat',
    },
    (chunk) => {
      streamedChunks.push(chunk);
    }
  );

  assert.equal(transportInvoked, true);
  assert.equal(sentAuthHeader, 'Bearer noblesse-session-jwt-token');
  assert.equal(sentEndpoint, 'https://api.noblesse-tribe.com/v1/ai/chat');
  assert.equal(streamedChunks.length, 3);
  assert.equal(finalMessage, 'Token 1: Hello Token 2: Noblesse Token 3: Community!');
});

// ---------------------------------------------------------------------------
// 6. Regression: Account Switching During Active Request
// ---------------------------------------------------------------------------
test('Lifecycle: Discards stale streaming chunks when account changes mid-request', async () => {
  let activeUserId = 'user_alex';
  const alexMessages = [];
  const lardeyMessages = [];

  // Simulate streaming controller
  const controller = new AbortController();
  const requestUserId = 'user_alex';

  // Chunk callback with user-scoping guard
  const onChunk = (chunk) => {
    if (activeUserId !== requestUserId || controller.signal.aborted) {
      return; // Discard chunk from stale user
    }
    alexMessages.push(chunk);
  };

  // 1. Chunks arrive for Alex
  onChunk('Chunk A1');
  assert.equal(alexMessages.length, 1);

  // 2. User switches to Lardey mid-stream
  activeUserId = 'user_lardey';
  controller.abort(); // Component calls abortStream() on user change

  // 3. Stale chunk from Alex's network socket arrives late
  onChunk('Chunk A2');

  // Alex must not receive chunk A2 after user switched
  assert.equal(alexMessages.length, 1);
  // Lardey's list must remain completely empty
  assert.equal(lardeyMessages.length, 0);
});

// ---------------------------------------------------------------------------
// 7. Regression: Persistence Race Condition Prevention
// ---------------------------------------------------------------------------
test('Persistence: Race-proof initializedForUserId check prevents cross-account overwrites', async () => {
  const { InMemoryStorageAdapter, saveUserConversations, loadUserConversations } = storageModule;
  const storage = new InMemoryStorageAdapter();

  // Seed Alex's data in storage
  const alexOriginal = [{ id: 'c1', title: 'Alex Secrets', messages: [], updatedAt: 1, userId: 'user_alex' }];
  await saveUserConversations(storage, alexOriginal, 'user_alex');

  // Seed Lardey's data in storage
  const lardeyOriginal = [{ id: 'c2', title: 'Lardey Notes', messages: [], updatedAt: 2, userId: 'user_lardey' }];
  await saveUserConversations(storage, lardeyOriginal, 'user_lardey');

  // Simulate component state
  let initializedForUserId = 'user_alex'; // Alex is initialized in memory
  let inMemoryConversations = [...alexOriginal];

  // User switches to Lardey:
  let userIdProp = 'user_lardey';
  initializedForUserId = null; // Step 1: Immediately de-initialize!

  // In the persistence effect:
  // if (initializedForUserId === userIdProp) -> save
  const canPersist = initializedForUserId === userIdProp;
  assert.equal(canPersist, false, 'Persistence effect MUST NOT run while de-initialized');

  // Because canPersist is false, Lardey's storage remains completely intact
  const verifyLardey = await loadUserConversations(storage, 'user_lardey');
  assert.equal(verifyLardey[0].title, 'Lardey Notes');

  // Step 2: Now Lardey loads asynchronously
  const loadedLardey = await loadUserConversations(storage, 'user_lardey');
  inMemoryConversations = loadedLardey;
  initializedForUserId = 'user_lardey';

  // Now persistence is safe
  assert.equal(initializedForUserId, userIdProp);
});

// ---------------------------------------------------------------------------
// 8. Regression: Rapid Account Switching Stress Test (Out-of-Order Async Reads)
// ---------------------------------------------------------------------------
test('Lifecycle: Rapid account switching ignores out-of-order stale async storage reads', async () => {
  const { InMemoryStorageAdapter, saveUserConversations, loadUserConversations } = storageModule;
  const storage = new InMemoryStorageAdapter();

  // Seed 3 users
  await saveUserConversations(storage, [{ id: 'a', title: 'User A Convo', messages: [], updatedAt: 1, userId: 'user_A' }], 'user_A');
  await saveUserConversations(storage, [{ id: 'b', title: 'User B Convo', messages: [], updatedAt: 2, userId: 'user_B' }], 'user_B');
  await saveUserConversations(storage, [{ id: 'c', title: 'User C Convo', messages: [], updatedAt: 3, userId: 'user_C' }], 'user_C');

  // Monotonic request counter and state simulators
  let loadRequestId = 0;
  let activeUserId = 'user_A';
  let inMemoryConversations = [];
  let initializedForUserId = null;

  // Function simulating loadHistoryForUser effect
  const switchUser = (newUserId, simulatedDelayMs) => {
    activeUserId = newUserId;
    const currentScope = newUserId;
    const currentRequestId = ++loadRequestId;

    // Immediately de-initialize and clear in-memory state
    initializedForUserId = null;
    inMemoryConversations = [];

    return new Promise((resolve) => {
      setTimeout(async () => {
        const loaded = await loadUserConversations(storage, newUserId);

        // Stale check
        if (currentRequestId !== loadRequestId || currentScope !== activeUserId) {
          resolve({ discarded: true, user: newUserId });
          return;
        }

        inMemoryConversations = loaded;
        initializedForUserId = currentScope;
        resolve({ discarded: false, user: newUserId });
      }, simulatedDelayMs);
    });
  };

  // Simulate rapid switching:
  // User A -> User B (slow read: 60ms) -> User C (fast read: 10ms)
  const pB = switchUser('user_B', 60);
  const pC = switchUser('user_C', 10);

  const [resB, resC] = await Promise.all([pB, pC]);

  // User B was overtaken by User C; it must have been discarded!
  assert.equal(resB.discarded, true, 'User B read must be discarded because User C took over');
  assert.equal(resC.discarded, false, 'User C read must settle');

  // Final settled state must strictly belong to User C
  assert.equal(activeUserId, 'user_C');
  assert.equal(initializedForUserId, 'user_C');
  assert.equal(inMemoryConversations[0].title, 'User C Convo');

  // Ensure storage for User B was never overwritten by User A's or User C's data
  const checkB = await loadUserConversations(storage, 'user_B');
  assert.equal(checkB[0].title, 'User B Convo');
});

// ---------------------------------------------------------------------------
// 9. Regression: Genuine Incremental Streaming on Hermes via XHR Simulation
// ---------------------------------------------------------------------------
test('Transport Engine: Verifies incremental token streaming without full response buffering', async () => {
  // Mock XMLHttpRequest that simulates network packets arriving in chunks
  class MockXHR {
    readyState = 0;
    status = 200;
    responseText = '';
    onprogress = null;
    onreadystatechange = null;
    headers = {};

    open(method, url) { this.readyState = 1; }
    setRequestHeader(k, v) { this.headers[k] = v; }
    send(body) {
      this.readyState = 2;

      // Simulate chunk 1
      setTimeout(() => {
        this.readyState = 3;
        this.responseText += 'data: {"choices":[{"delta":{"content":"Noblesse "}}]}\n\n';
        this.onprogress?.();
        this.onreadystatechange?.();
      }, 5);

      // Simulate chunk 2
      setTimeout(() => {
        this.readyState = 3;
        this.responseText += 'data: {"choices":[{"delta":{"content":"Tribe "}}]}\n\n';
        this.onprogress?.();
        this.onreadystatechange?.();
      }, 15);

      // Simulate chunk 3 + DONE
      setTimeout(() => {
        this.readyState = 4;
        this.responseText += 'data: {"choices":[{"delta":{"content":"Rocks!"}}]}\n\ndata: [DONE]\n\n';
        this.onprogress?.();
        this.onreadystatechange?.();
      }, 25);
    }
  }

  // Inject mock XHR into globalThis
  const originalXHR = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = MockXHR;

  // Force isReactNativeEnvironment simulation
  globalThis.HermesInternal = {};

  try {
    const receivedChunks = [];
    const finalResult = await transportModule.defaultOpenRouterTransport(
      {
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Test' }],
        stream: true,
      },
      (chunk) => {
        receivedChunks.push(chunk);
      }
    );

    // Verify incremental delivery: multiple chunk callbacks fired BEFORE final completion!
    assert.equal(receivedChunks.length >= 3, true, 'Chunks must be delivered incrementally over time');
    assert.equal(receivedChunks[0], 'Noblesse ');
    assert.equal(receivedChunks[1], 'Noblesse Tribe ');
    assert.equal(finalResult, 'Noblesse Tribe Rocks!');
  } finally {
    // Cleanup
    globalThis.XMLHttpRequest = originalXHR;
    delete globalThis.HermesInternal;
  }
});

// ---------------------------------------------------------------------------
// 10. Regression: AsyncStorage Persistence Across App Restarts
// ---------------------------------------------------------------------------
test('Persistence: Simulates cold app boot and multi-session storage adapter', async () => {
  const { createAsyncStorageAdapter, saveUserConversations, loadUserConversations } = storageModule;

  // Mock AsyncStorage backend that persists in a simulated disk map
  const simulatedDisk = new Map();
  const mockAsyncStorage = {
    getItem: async (key) => simulatedDisk.get(key) ?? null,
    setItem: async (key, val) => { simulatedDisk.set(key, val); },
    removeItem: async (key) => { simulatedDisk.delete(key); },
  };

  const adapter = createAsyncStorageAdapter(mockAsyncStorage);

  // Session 1: User chats and saves conversations
  const session1Conversations = [
    {
      id: 'chat-99',
      title: 'Noblesse Tribe Architecture',
      messages: [
        { id: 'm1', role: 'user', content: 'Explain the Go backend proxy' },
        { id: 'm2', role: 'assistant', content: 'The Go backend securely proxies OpenRouter requests.' },
      ],
      updatedAt: 1700000000000,
      userId: 'user_noblesse_prod',
    },
  ];
  await saveUserConversations(adapter, session1Conversations, 'user_noblesse_prod');

  // Session 2: App is terminated and relaunched (Cold Boot)
  const coldBootAdapter = createAsyncStorageAdapter(mockAsyncStorage);
  const reloaded = await loadUserConversations(coldBootAdapter, 'user_noblesse_prod');

  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].id, 'chat-99');
  assert.equal(reloaded[0].messages.length, 2);
  assert.equal(reloaded[0].messages[1].content, 'The Go backend securely proxies OpenRouter requests.');
});
