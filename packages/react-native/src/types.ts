/**
 * @noblesse/vibe-chat-native
 * Core TypeScript definitions and interface contracts.
 */

import React from 'react';
import { StyleProp, ViewStyle, TextStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Brand Palettes & Theming
// ---------------------------------------------------------------------------

export const NOBLESSE_BRAND = {
  blueDark: '#201E5A',
  blueLight: '#0AB1DE',
  green: '#01C542',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export interface VibeChatColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  userBubbleBackground: string;
  userBubbleText: string;
  assistantBubbleBackground: string;
  assistantBubbleText: string;
  errorBackground: string;
  errorText: string;
  fabBackground?: string;
  fabRingColor?: string;
  sendButtonBackground?: string;
  sendButtonIcon?: string;
}

export interface VibeChatTypography {
  fontFamily?: string;
  headerFontSize?: number;
  bodyFontSize?: number;
  smallFontSize?: number;
  lineHeight?: number;
}

export interface VibeChatBorderRadius {
  sm?: number;
  md?: number;
  lg?: number;
  bubble?: number;
  full?: number;
}

export interface VibeChatCustomStyles {
  container?: StyleProp<ViewStyle>;
  header?: StyleProp<ViewStyle>;
  fab?: StyleProp<ViewStyle>;
  input?: StyleProp<TextStyle>;
  bubbleUser?: StyleProp<ViewStyle>;
  bubbleAssistant?: StyleProp<ViewStyle>;
}

export interface VibeChatTheme {
  mode?: 'light' | 'dark' | 'auto';
  colors: Partial<VibeChatColors>;
  typography?: VibeChatTypography;
  borderRadius?: VibeChatBorderRadius;
  customStyles?: VibeChatCustomStyles;
}

// ---------------------------------------------------------------------------
// Messages & Conversations
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'error' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp?: number;
  rawError?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  userId?: string;
}

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Storage Adapter (Multi-Account / User Scoped)
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface UserScopedStorageAdapter extends StorageAdapter {
  clearUserHistory(userId?: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Transport & Networking
// ---------------------------------------------------------------------------

export interface TransportRequestMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TransportRequest {
  model: string;
  messages: TransportRequestMessage[];
  stream: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  endpoint?: string;
  apiKey?: string;
}

export type ChatTransport = (
  req: TransportRequest,
  onChunk: (chunkText: string) => void
) => Promise<string>;

// ---------------------------------------------------------------------------
// Clipboard Adapter
// ---------------------------------------------------------------------------

export interface ClipboardAdapter {
  setString(content: string): void | Promise<void>;
  getString?(): Promise<string>;
}

// ---------------------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------------------

export interface VibeChatBaseProps {
  /**
   * Theme configuration: either a full VibeChatTheme object or partial colors.
   * Can use `noblesseTribeTheme` or a custom brand palette.
   */
  theme?: VibeChatTheme | Partial<VibeChatColors>;

  /**
   * Assistant display name shown in header and titles.
   * Defaults to "Noblesse AI" or "VibeChat".
   */
  assistantName?: string;

  /** Title shown on empty screen before any messages are sent */
  welcomeTitle?: string;

  /** Subtitle shown on empty screen */
  welcomeSubtitle?: string;

  /** Custom avatar element or image URI for the assistant */
  assistantAvatar?: React.ReactNode;

  /** Custom avatar element or label for the user */
  userAvatar?: React.ReactNode;

  /** Placeholder text in the message input field */
  placeholder?: string;

  /** Legal disclaimer or model warning text at the bottom */
  disclaimer?: string;

  /** Quick prompt suggestions on empty state */
  suggestions?: string[];

  /**
   * OpenRouter API key.
   * NOTE: For production, prefer a backend proxy or secure credential storage!
   */
  openRouterKey?: string;

  /**
   * Custom backend endpoint URL (e.g. Noblesse Tribe's Go backend proxy).
   * Defaults to https://openrouter.ai/api/v1/chat/completions.
   */
  endpoint?: string;

  /**
   * Custom headers attached to requests (e.g. Authorization: Bearer <JWT>).
   */
  headers?: Record<string, string>;

  /**
   * Caller-provided network transport for maximum flexibility.
   */
  transport?: ChatTransport;

  /** Default AI model ID */
  defaultModel?: string;

  /** List of selectable models */
  models?: ModelOption[];

  /**
   * Signed-in User ID.
   * Scopes conversation history to this user, preventing data leakage across accounts!
   */
  userId?: string;

  /**
   * Storage adapter (AsyncStorage or in-memory).
   */
  storage?: StorageAdapter;

  /** Custom clipboard adapter for copying messages */
  clipboard?: ClipboardAdapter;

  /** Lifecycle callbacks */
  onError?: (error: Error) => void;
  onMessageSent?: (message: Message) => void;
  onResponseComplete?: (message: Message) => void;
  onConversationChange?: (conversation: Conversation | null) => void;
}

export interface VibeChatViewProps extends VibeChatBaseProps {
  /** Optional back/close button click handler */
  onClose?: () => void;
  /** Whether to show the top navigation header bar */
  showHeader?: boolean;
}

export interface VibeChatNativeWidgetProps extends VibeChatBaseProps {
  /** Open the modal automatically on initial mount */
  initialOpen?: boolean;
  /** Callback when the modal opens */
  onOpen?: () => void;
  /** Callback when the modal closes */
  onClose?: () => void;
  /** Positioning offset for the Floating Action Button */
  fabPosition?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
  };
  /** Custom icon or element for the FAB */
  fabIcon?: React.ReactNode;
}

export interface VibeChatRef {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  sendMessage: (text: string) => Promise<void>;
  abort: () => void;
  clearHistory: () => Promise<void>;
  newChat: () => void;
}
