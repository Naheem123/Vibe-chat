/**
 * @noblesse/vibe-chat-native
 * Secure, multi-account storage adapter supporting user isolation and logout clearing.
 */
import { StorageAdapter, Conversation } from './types';
export declare const DEFAULT_STORAGE_PREFIX = "vibe_chat_";
/**
 * In-memory fallback adapter when @react-native-async-storage/async-storage
 * is not installed in the host project.
 */
export declare class InMemoryStorageAdapter implements StorageAdapter {
    private memory;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}
/**
 * Helper to wrap standard @react-native-async-storage/async-storage.
 */
export declare function createAsyncStorageAdapter(asyncStorageInstance: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
}): StorageAdapter;
/**
 * Computes a scoped storage key for a specific user ID to isolate histories.
 */
export declare function getUserStorageKey(userId?: string, prefix?: string): string;
/**
 * Loads conversation history scoped strictly to the current user.
 */
export declare function loadUserConversations(storage: StorageAdapter, userId?: string, prefix?: string): Promise<Conversation[]>;
/**
 * Saves conversation history scoped strictly to the current user.
 */
export declare function saveUserConversations(storage: StorageAdapter, conversations: Conversation[], userId?: string, prefix?: string): Promise<void>;
/**
 * Clears conversation history for a given user upon logout.
 */
export declare function clearUserConversations(storage: StorageAdapter, userId?: string, prefix?: string): Promise<void>;
//# sourceMappingURL=storage.d.ts.map