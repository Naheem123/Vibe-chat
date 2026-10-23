/**
 * VibeChatNativeWidget.tsx
 * -----------------------------------------------------------------------
 * A self-contained React Native SDK component that embeds the VibeChat
 * conversational AI experience as a native in-app overlay.
 *
 * ✅ Zero WebView / Zero DOM usage — 100 % React Native primitives only.
 * ✅ Floating Action Button → full-screen Modal with slide animation.
 * ✅ Streams tokens from OpenRouter in real-time using the Fetch API.
 * ✅ Persists conversation history via @react-native-async-storage/async-storage
 *    (gracefully degrades to in-memory state when the package is absent).
 * ✅ Works on both iOS and Android.
 *
 * Usage
 * -----------------------------------------------------------------------
 * import { VibeChatNativeWidget } from './src/react-native/VibeChatNativeWidget';
 *
 * export default function App() {
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <YourAppContent />
 *       <VibeChatNativeWidget
 *         openRouterKey="sk-or-..."
 *         accentColor="#6366f1"
 *         defaultModel="google/gemini-2.5-flash"
 *         initialOpen={false}
 *       />
 *     </View>
 *   );
 * }
 *
 * Peer Dependencies
 * -----------------------------------------------------------------------
 * - react-native (bundled with every RN project)
 * - @react-native-async-storage/async-storage (optional, recommended)
 *   npm install @react-native-async-storage/async-storage
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  Alert,
  Clipboard,
  StatusBar,
} from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VibeChatNativeWidgetProps {
  /** Accent / brand colour used for the FAB and user-bubble highlight. */
  accentColor?: string;
  /** Your OpenRouter API key (sk-or-…). Required to send messages. */
  openRouterKey?: string;
  /** OpenRouter model string. Defaults to Gemini 2.5 Flash. */
  defaultModel?: string;
  /** Open the chat modal immediately on first render. */
  initialOpen?: boolean;
  /**
   * Optional custom storage adapter.
   * Pass `AsyncStorage` from @react-native-async-storage/async-storage here,
   * or provide any object satisfying the StorageAdapter interface.
   */
  storage?: StorageAdapter;
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type MessageRole = 'user' | 'assistant' | 'error';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'vibe-chat-rn-history';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS: { id: string; label: string }[] = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
];

const SUGGESTIONS = [
  '✨ Explain quantum computing simply',
  '🧑‍💻 Write a React hook for debouncing',
  '🌍 Translate "Hello World" to 5 languages',
  '📖 Summarise the book "Atomic Habits"',
];

// ---------------------------------------------------------------------------
// Tiny ID generator (no uuid dependency)
// ---------------------------------------------------------------------------

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Typing indicator dots (animated — no external animation library)
// ---------------------------------------------------------------------------

function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -6,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 150);
    const a3 = bounce(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color,
    marginHorizontal: 2,
    transform: [{ translateY: anim }],
  });

  return (
    <View style={styles.typingRow}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// FAB with subtle pulse ring animation
// ---------------------------------------------------------------------------

function FABPulse({
  accentColor,
  onPress,
}: {
  accentColor: string;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.fab, { backgroundColor: accentColor }]}
      accessibilityLabel="Open VibeChat"
      accessibilityRole="button"
    >
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.fabRing,
          { borderColor: accentColor, transform: [{ scale: pulse }] },
        ]}
      />
      {/* Chat icon drawn with two nested views */}
      <View style={styles.fabIconWrap}>
        <View style={styles.fabBubble} />
        <View style={styles.fabBubbleTail} />
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Individual message bubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
  accentColor: string;
}

function MessageBubble({ message, accentColor }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    Clipboard.setString(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  return (
    <View
      style={[
        styles.bubbleWrapper,
        isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant,
      ]}
    >
      {/* AI avatar */}
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: accentColor + '22' }]}>
          <Text style={[styles.avatarText, { color: accentColor }]}>AI</Text>
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: accentColor }]
            : isError
            ? styles.bubbleError
            : styles.bubbleAssistant,
        ]}
      >
        {/* Render plain text (markdown rendering requires external deps) */}
        <Text
          style={[
            styles.bubbleText,
            isUser
              ? styles.bubbleTextUser
              : isError
              ? styles.bubbleTextError
              : styles.bubbleTextAssistant,
          ]}
          selectable
        >
          {message.content}
        </Text>

        {/* Copy button — assistant messages only */}
        {!isUser && !isError && message.content.length > 0 && (
          <TouchableOpacity
            onPress={handleCopy}
            style={styles.copyBtn}
            accessibilityLabel="Copy message"
          >
            <Text style={styles.copyBtnText}>{copied ? '✓ Copied' : '⎘ Copy'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isUser && (
        <View style={[styles.avatar, { backgroundColor: accentColor }]}>
          <Text style={styles.avatarTextUser}>U</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Model picker bottom sheet
// ---------------------------------------------------------------------------

interface ModelPickerProps {
  visible: boolean;
  selectedModel: string;
  onSelect: (model: string) => void;
  onClose: () => void;
  accentColor: string;
}

function ModelPicker({
  visible,
  selectedModel,
  onSelect,
  onClose,
  accentColor,
}: ModelPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Select Model</Text>
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.pickerItem,
                selectedModel === m.id && {
                  backgroundColor: accentColor + '18',
                },
              ]}
              onPress={() => {
                onSelect(m.id);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.pickerItemText,
                  selectedModel === m.id && {
                    color: accentColor,
                    fontWeight: '700',
                  },
                ]}
              >
                {m.label}
              </Text>
              {selectedModel === m.id && (
                <Text style={[styles.checkmark, { color: accentColor }]}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Conversation sidebar (slide-in drawer)
// ---------------------------------------------------------------------------

interface SidebarProps {
  visible: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  accentColor: string;
}

function Sidebar({
  visible,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onClose,
  accentColor,
}: SidebarProps) {
  const slideX = useRef(new Animated.Value(-310)).current;

  useEffect(() => {
    Animated.timing(slideX, {
      toValue: visible ? 0 : -310,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slideX]);

  return (
    <>
      {visible && (
        <Pressable style={styles.sidebarBackdrop} onPress={onClose} />
      )}
      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: slideX }] }]}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>VibeChat</Text>
            <TouchableOpacity onPress={onClose} style={styles.sidebarClose}>
              <Text style={styles.sidebarCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.newChatBtn, { borderColor: accentColor + '55' }]}
            onPress={() => {
              onNewChat();
              onClose();
            }}
          >
            <Text style={[styles.newChatBtnText, { color: accentColor }]}>
              ＋  New Chat
            </Text>
          </TouchableOpacity>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.convRow,
                  activeId === item.id && {
                    backgroundColor: accentColor + '14',
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.convRowContent}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.convTitle,
                      activeId === item.id && { color: accentColor },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.convDate}>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert('Delete Conversation', 'Delete this conversation?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => onDelete(item.id),
                      },
                    ])
                  }
                  style={styles.convDeleteBtn}
                >
                  <Text style={styles.convDeleteText}>🗑</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.convEmpty}>No conversations yet.</Text>
            }
          />
        </SafeAreaView>
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function VibeChatNativeWidget({
  accentColor = '#6366f1',
  openRouterKey = '',
  defaultModel = DEFAULT_MODEL,
  initialOpen = false,
  storage,
}: VibeChatNativeWidgetProps) {
  // ── Local state ──────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState(defaultModel);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);
  const abortFlagRef = useRef(false);

  // ── Derived state ────────────────────────────────────────────────────────
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const messages: Message[] = activeConversation?.messages ?? [];

  // ── Storage helpers ──────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!storage) return;
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Conversation[] = JSON.parse(raw);
        setConversations(parsed);
        if (parsed.length > 0) setActiveId(parsed[0].id);
      }
    } catch {
      /* ignore */
    } finally {
      setIsInitialized(true);
    }
  }, [storage]);

  const saveHistory = useCallback(
    async (convs: Conversation[]) => {
      if (!storage) return;
      try {
        await storage.setItem(STORAGE_KEY, JSON.stringify(convs));
      } catch {
        /* ignore */
      }
    },
    [storage],
  );

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (storage) {
      loadHistory();
    } else {
      setIsInitialized(true);
    }
  }, [loadHistory, storage]);

  useEffect(() => {
    if (isInitialized) saveHistory(conversations);
  }, [conversations, isInitialized, saveHistory]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      const t = setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        80,
      );
      return () => clearTimeout(t);
    }
  }, [messages.length, isStreaming]);

  // ── Conversation management ──────────────────────────────────────────────
  const handleNewChat = useCallback(() => setActiveId(null), []);

  const handleSelectConversation = useCallback(
    (id: string) => setActiveId(id),
    [],
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const apiKey = openRouterKey.trim();
    if (!apiKey) {
      Alert.alert(
        'API Key Missing',
        'Please provide an openRouterKey prop to send messages.',
      );
      return;
    }

    setInputText('');
    abortFlagRef.current = false;

    // Determine conversation ID before state update
    const isNewConv = !activeId;
    const convId = isNewConv ? uid() : (activeId as string);

    const userMsg: Message = { id: uid(), role: 'user', content: text };

    // Capture current history before state updates
    const priorMessages = activeConversation?.messages ?? [];

    setConversations((prev) => {
      if (isNewConv) {
        const newConv: Conversation = {
          id: convId,
          title: text.slice(0, 40),
          messages: [userMsg],
          updatedAt: Date.now(),
        };
        return [newConv, ...prev];
      }
      return prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() }
          : c,
      );
    });

    if (isNewConv) setActiveId(convId);
    setIsStreaming(true);

    try {
      const historyPayload = [...priorMessages, userMsg]
        .slice(-40)
        .map((m) => ({
          role: m.role === 'error' ? 'assistant' : m.role,
          content: m.content,
        }));

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vibechat.app',
          'X-Title': 'VibeChat Native Widget',
        },
        body: JSON.stringify({ model, messages: historyPayload, stream: true }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`OpenRouter error ${response.status}: ${errText.slice(0, 200)}`);
      }

      // Insert blank placeholder for the streaming assistant message
      const assistantMsgId = uid();
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { id: assistantMsgId, role: 'assistant', content: '' },
                ],
              }
            : c,
        ),
      );

      // ── SSE streaming ──────────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = response.body as any;
      let accumulated = '';

      if (body && typeof body.getReader === 'function') {
        // Hermes / New Architecture: true ReadableStream available
        const reader: ReadableStreamDefaultReader<Uint8Array> = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (abortFlagRef.current) break;
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]')
              continue;
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const chunk: string = parsed.choices?.[0]?.delta?.content ?? '';
              if (!chunk) continue;
              accumulated += chunk;

              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== convId) return c;
                  const msgs = [...c.messages];
                  const lastIdx = msgs.length - 1;
                  if (msgs[lastIdx]?.id === assistantMsgId) {
                    msgs[lastIdx] = { ...msgs[lastIdx], content: accumulated };
                  }
                  return { ...c, messages: msgs, updatedAt: Date.now() };
                }),
              );
            } catch {
              /* partial JSON — skip */
            }
          }
        }
      } else {
        // Old Architecture fallback: response.text() bulk parse
        const fullText = await response.text();
        for (const line of fullText.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]')
            continue;
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            accumulated += parsed.choices?.[0]?.delta?.content ?? '';
          } catch {
            /* skip */
          }
        }

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            const msgs = [...c.messages];
            const lastIdx = msgs.length - 1;
            if (msgs[lastIdx]?.id === assistantMsgId) {
              msgs[lastIdx] = { ...msgs[lastIdx], content: accumulated };
            }
            return { ...c, messages: msgs, updatedAt: Date.now() };
          }),
        );
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'An unknown error occurred.';
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { id: uid(), role: 'error', content: `⚠️  ${errMsg}` },
                ],
                updatedAt: Date.now(),
              }
            : c,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }, [
    inputText,
    isStreaming,
    openRouterKey,
    activeId,
    activeConversation,
    model,
  ]);

  // ── Renderers ────────────────────────────────────────────────────────────
  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble message={item} accentColor={accentColor} />
    ),
    [accentColor],
  );

  const modelLabel = useMemo(
    () => MODELS.find((m) => m.id === model)?.label ?? model,
    [model],
  );

  if (!isInitialized) return null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Full-screen chat modal ────────────────────────────────────── */}
      <Modal
        visible={isOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsOpen(false)}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="#0f0f14"
          translucent={false}
        />

        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: accentColor + '30' }]}>
            {/* Hamburger / sidebar */}
            <TouchableOpacity
              onPress={() => setIsSidebarOpen(true)}
              style={styles.headerBtn}
              accessibilityLabel="Open conversations sidebar"
            >
              <View style={styles.hamburger}>
                <View style={[styles.hamburgerLine, { backgroundColor: '#e2e8f0' }]} />
                <View
                  style={[
                    styles.hamburgerLine,
                    { backgroundColor: '#e2e8f0', width: 16 },
                  ]}
                />
                <View style={[styles.hamburgerLine, { backgroundColor: '#e2e8f0' }]} />
              </View>
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>VibeChat</Text>
              <View style={[styles.headerDot, { backgroundColor: accentColor }]} />
            </View>

            {/* Close (✕) */}
            <TouchableOpacity
              onPress={() => setIsOpen(false)}
              style={styles.headerBtn}
              accessibilityLabel="Close chat"
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Keyboard-safe area */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Message list / empty state */}
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyOrb,
                    {
                      backgroundColor: accentColor + '20',
                      borderColor: accentColor + '40',
                    },
                  ]}
                >
                  <Text style={styles.emptyOrbText}>✦</Text>
                </View>
                <Text style={styles.emptyTitle}>How can I help you?</Text>
                <Text style={styles.emptySubtitle}>
                  Ask anything — powered by {modelLabel}.
                </Text>

                {/* Suggestion chips */}
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.chip,
                        { borderColor: accentColor + '50' },
                      ]}
                      onPress={() =>
                        // Strip the leading emoji prefix
                        setInputText(s.replace(/^[\p{Emoji}\s]+/u, '').trim())
                      }
                    >
                      <Text style={styles.chipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(m) => m.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageListContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
                ListFooterComponent={
                  isStreaming ? (
                    <View style={styles.streamingRow}>
                      <View
                        style={[
                          styles.streamingAvatar,
                          { backgroundColor: accentColor + '22' },
                        ]}
                      >
                        <Text
                          style={[styles.avatarText, { color: accentColor }]}
                        >
                          AI
                        </Text>
                      </View>
                      <View style={styles.streamingBubble}>
                        <TypingDots color={accentColor} />
                      </View>
                    </View>
                  ) : null
                }
              />
            )}

            {/* Input bar */}
            <View style={styles.inputBar}>
              {/* Model selector badge */}
              <TouchableOpacity
                onPress={() => setIsModelPickerOpen(true)}
                style={[
                  styles.modelBadge,
                  { borderColor: accentColor + '55' },
                ]}
                accessibilityLabel="Select AI model"
              >
                <Text
                  style={[styles.modelBadgeText, { color: accentColor }]}
                >
                  ⚡ {modelLabel}
                </Text>
                <Text
                  style={[styles.modelBadgeChevron, { color: accentColor }]}
                >
                  ▾
                </Text>
              </TouchableOpacity>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask anything…"
                  placeholderTextColor="#64748b"
                  multiline
                  maxLength={4000}
                  editable={!isStreaming}
                  returnKeyType="default"
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!inputText.trim() || isStreaming}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor:
                        inputText.trim() && !isStreaming
                          ? accentColor
                          : accentColor + '44',
                    },
                  ]}
                  accessibilityLabel="Send message"
                >
                  {isStreaming ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.sendBtnIcon}>↑</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.disclaimer}>
                VibeChat can make mistakes. Verify important information.
              </Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Slide-in conversation sidebar (rendered inside Modal so it overlays correctly) */}
        <Sidebar
          visible={isSidebarOpen}
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onDelete={handleDeleteConversation}
          onClose={() => setIsSidebarOpen(false)}
          accentColor={accentColor}
        />

        {/* Model picker bottom-sheet */}
        <ModelPicker
          visible={isModelPickerOpen}
          selectedModel={model}
          onSelect={setModel}
          onClose={() => setIsModelPickerOpen(false)}
          accentColor={accentColor}
        />
      </Modal>

      {/* ── Floating Action Button (only visible when chat is closed) ──── */}
      {!isOpen && (
        <FABPulse accentColor={accentColor} onPress={() => setIsOpen(true)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const { width: SCREEN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 999,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 12,
  },
  fabRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    opacity: 0.35,
  },
  fabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBubble: {
    width: 26,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  fabBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 0,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -2,
    marginLeft: 8,
    alignSelf: 'flex-end',
  },

  // Safe area / base
  safeArea: {
    flex: 1,
    backgroundColor: '#0f0f14',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: '#0f0f14',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  hamburger: {
    gap: 4,
    alignItems: 'flex-start',
  },
  hamburgerLine: {
    height: 2,
    width: 20,
    borderRadius: 2,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.3,
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  closeBtn: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  emptyOrb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyOrbText: {
    fontSize: 38,
    color: '#a5b4fc',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  suggestions: {
    width: '100%',
    gap: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#1e1e2e',
  },
  chipText: {
    color: '#cbd5e1',
    fontSize: 13.5,
    fontWeight: '500',
  },

  // Message list
  messageListContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },

  // Bubble
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  bubbleWrapperUser: {
    justifyContent: 'flex-end',
  },
  bubbleWrapperAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  avatarTextUser: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  bubble: {
    maxWidth: SCREEN_W * 0.75,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#1e1e2e',
    borderBottomLeftRadius: 4,
  },
  bubbleError: {
    backgroundColor: '#3b0c0c',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  bubbleTextAssistant: {
    color: '#e2e8f0',
  },
  bubbleTextError: {
    color: '#fca5a5',
  },
  copyBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  copyBtnText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  // Typing indicator
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  streamingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  streamingAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamingBubble: {
    backgroundColor: '#1e1e2e',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Input bar
  inputBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    backgroundColor: '#0f0f14',
    borderTopWidth: 1,
    borderTopColor: '#1e1e2e',
    gap: 8,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#1a1a28',
  },
  modelBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modelBadgeChevron: {
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: '#1a1a28',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  textInput: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 15,
    maxHeight: 140,
    paddingVertical: Platform.OS === 'ios' ? 4 : 0,
    lineHeight: 22,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  sendBtnIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#334155',
    paddingBottom: 2,
  },

  // Sidebar
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 99,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 290,
    backgroundColor: '#13131e',
    zIndex: 100,
    borderRightWidth: 1,
    borderRightColor: '#1e1e2e',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  sidebarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  sidebarClose: {
    padding: 4,
  },
  sidebarCloseText: {
    fontSize: 17,
    color: '#64748b',
  },
  newChatBtn: {
    marginHorizontal: 14,
    marginVertical: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  newChatBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
  },
  convRowContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  convTitle: {
    fontSize: 13.5,
    color: '#cbd5e1',
    fontWeight: '500',
    marginBottom: 2,
  },
  convDate: {
    fontSize: 11,
    color: '#475569',
  },
  convDeleteBtn: {
    padding: 10,
  },
  convDeleteText: {
    fontSize: 15,
  },
  convEmpty: {
    textAlign: 'center',
    color: '#475569',
    marginTop: 32,
    fontSize: 13,
  },

  // Model picker
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#13131e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#1e1e2e',
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  pickerItemText: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default VibeChatNativeWidget;
