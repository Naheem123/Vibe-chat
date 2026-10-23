"use strict";
/**
 * @noblesse/vibe-chat-native
 * Secure, multi-account storage adapter supporting user isolation and logout clearing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryStorageAdapter = exports.DEFAULT_STORAGE_PREFIX = void 0;
exports.createAsyncStorageAdapter = createAsyncStorageAdapter;
exports.getUserStorageKey = getUserStorageKey;
exports.loadUserConversations = loadUserConversations;
exports.saveUserConversations = saveUserConversations;
exports.clearUserConversations = clearUserConversations;
exports.DEFAULT_STORAGE_PREFIX = 'vibe_chat_';
/**
 * In-memory fallback adapter when @react-native-async-storage/async-storage
 * is not installed in the host project.
 */
class InMemoryStorageAdapter {
    constructor() {
        this.memory = new Map();
    }
    async getItem(key) {
        return this.memory.get(key) ?? null;
    }
    async setItem(key, value) {
        this.memory.set(key, value);
    }
    async removeItem(key) {
        this.memory.delete(key);
    }
    async clear() {
        this.memory.clear();
    }
}
exports.InMemoryStorageAdapter = InMemoryStorageAdapter;
/**
 * Helper to wrap standard @react-native-async-storage/async-storage.
 */
function createAsyncStorageAdapter(asyncStorageInstance) {
    return {
        getItem: (key) => asyncStorageInstance.getItem(key),
        setItem: (key, value) => asyncStorageInstance.setItem(key, value),
        removeItem: (key) => asyncStorageInstance.removeItem(key),
    };
}
/**
 * Computes a scoped storage key for a specific user ID to isolate histories.
 */
function getUserStorageKey(userId, prefix = exports.DEFAULT_STORAGE_PREFIX) {
    const sanitizedId = userId ? encodeURIComponent(userId.trim()) : 'guest';
    return `${prefix}user_${sanitizedId}_history`;
}
/**
 * Loads conversation history scoped strictly to the current user.
 */
async function loadUserConversations(storage, userId, prefix = exports.DEFAULT_STORAGE_PREFIX) {
    try {
        const key = getUserStorageKey(userId, prefix);
        const raw = await storage.getItem(key);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed;
    }
    catch {
        return [];
    }
}
/**
 * Saves conversation history scoped strictly to the current user.
 */
async function saveUserConversations(storage, conversations, userId, prefix = exports.DEFAULT_STORAGE_PREFIX) {
    try {
        const key = getUserStorageKey(userId, prefix);
        await storage.setItem(key, JSON.stringify(conversations));
    }
    catch {
        /* ignore storage write failures gracefully */
    }
}
/**
 * Clears conversation history for a given user upon logout.
 */
async function clearUserConversations(storage, userId, prefix = exports.DEFAULT_STORAGE_PREFIX) {
    try {
        const key = getUserStorageKey(userId, prefix);
        await storage.removeItem(key);
    }
    catch {
        /* ignore */
    }
}
//# sourceMappingURL=storage.js.map