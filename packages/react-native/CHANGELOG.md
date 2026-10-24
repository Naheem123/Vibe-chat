# Changelog

All notable changes to `@noblesse/vibe-chat-native` are documented here.

## [1.0.2] - 2026-10-24

### Fixed & Enhanced
- **Account Switching Race Condition**: Fixed an asynchronous race condition in history loading and persistence where switching users could write one user's conversations into another user's storage namespace. Added `loadedUserIdRef` verification to guard persistence.
- **Request Lifecycle & Cancellation**: 
  - Requests now automatically abort when the authenticated `userId` changes, when the user logs out, or when the chat component unmounts.
  - Added user-scoping guards to streaming chunk callbacks to guarantee that stale chunks from previous user requests are dropped and never leak into another account's conversation state.
- **Incremental Streaming on Hermes**:
  - Implemented true incremental SSE token streaming on React Native Hermes (iOS and Android) using `XMLHttpRequest` with `onprogress` chunk slices.
  - Eliminated full-response buffering when `response.body.getReader()` is unavailable.
- **Streaming Error Handling**:
  - Added detection for provider-side SSE error events (e.g. rate limits, quota exhaustion, content filters) and empty responses, preventing false success states.
- **Ambient Type Declarations**:
  - Added `ScrollView` and `Image` component declarations to enable zero-dependency compilation in standalone projects.
- **Regression Test Suite**:
  - Added automated tests for account switching mid-stream, persistence race condition prevention, provider SSE errors, and cold boot persistence.

## [1.0.0] - 2026-10-23

### Initial Release
- Initial extraction of `@noblesse/vibe-chat-native`.
- Reusable `<VibeChatNativeWidget />` (floating modal launcher) and `<VibeChatView />` (embedded full-screen view).
- Configurable theming with built-in Noblesse Tribe brand palette (`#201E5A`, `#0AB1DE`, `#01C542`, `#FFFFFF`, `#000000`).
- Scoped multi-account conversation storage adapter.
- Caller-provided transport and endpoint support for Noblesse Tribe Go backend proxy.
- Modern clipboard compatibility fallback.
- Dual CommonJS and ES Module builds with TypeScript declarations.
