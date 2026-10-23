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
  const { resolveTheme, noblesseTribeTheme, noblesseTribeLightColors, noblesseTribeDarkColors } = themeModule;

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
  const { parseSSELine } = transportModule;

  // Valid streaming chunk
  const validLine = 'data: {"choices":[{"delta":{"content":"Hello from Noblesse AI"}}]}';
  assert.equal(parseSSELine(validLine), 'Hello from Noblesse AI');

  // End of stream indicator
  assert.equal(parseSSELine('data: [DONE]'), null);

  // Ping / comments / empty lines
  assert.equal(parseSSELine(''), null);
  assert.equal(parseSSELine(': heartbeat'), null);
  assert.equal(parseSSELine('event: ping'), null);

  // Broken/partial JSON (must not throw error)
  assert.equal(parseSSELine('data: {"choices":[{"delta":{"conte'), null);
});

// ---------------------------------------------------------------------------
// 4. Custom Transport / Noblesse Tribe Go Backend Proxy Test
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
