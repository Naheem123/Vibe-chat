/**
 * @noblesse/vibe-chat-native
 * Secure, multi-account storage adapter supporting user isolation and logout clearing.
 */

import { StorageAdapter, Conversation } from './types';

export const DEFAULT_STORAGE_PREFIX = 'vibe_chat_';

/**
 * In-memory fallback adapter when @react-native-async-storage/async-storage
 * is not installed in the host project.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private memory = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.memory.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.memory.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.memory.delete(key);
  }

  async clear(): Promise<void> {
    this.memory.clear();
  }
}

/**
 * Helper to wrap standard @react-native-async-storage/async-storage.
 */
export function createAsyncStorageAdapter(asyncStorageInstance: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}): StorageAdapter {
  return {
    getItem: (key: string) => asyncStorageInstance.getItem(key),
    setItem: (key: string, value: string) =>
      asyncStorageInstance.setItem(key, value),
    removeItem: (key: string) => asyncStorageInstance.removeItem(key),
  };
}

/**
 * Computes a scoped storage key for a specific user ID to isolate histories.
 */
export function getUserStorageKey(
  userId?: string,
  prefix: string = DEFAULT_STORAGE_PREFIX
): string {
  const sanitizedId = userId ? encodeURIComponent(userId.trim()) : 'guest';
  return `${prefix}user_${sanitizedId}_history`;
}

/**
 * Loads conversation history scoped strictly to the current user.
 */
export async function loadUserConversations(
  storage: StorageAdapter,
  userId?: string,
  prefix: string = DEFAULT_STORAGE_PREFIX
): Promise<Conversation[]> {
  try {
    const key = getUserStorageKey(userId, prefix);
    const raw = await storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Saves conversation history scoped strictly to the current user.
 */
export async function saveUserConversations(
  storage: StorageAdapter,
  conversations: Conversation[],
  userId?: string,
  prefix: string = DEFAULT_STORAGE_PREFIX
): Promise<void> {
  try {
    const key = getUserStorageKey(userId, prefix);
    await storage.setItem(key, JSON.stringify(conversations));
  } catch {
    /* ignore storage write failures gracefully */
  }
}

/**
 * Clears conversation history for a given user upon logout.
 */
export async function clearUserConversations(
  storage: StorageAdapter,
  userId?: string,
  prefix: string = DEFAULT_STORAGE_PREFIX
): Promise<void> {
  try {
    const key = getUserStorageKey(userId, prefix);
    await storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
