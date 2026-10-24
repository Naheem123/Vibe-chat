/**
 * @noblesse/vibe-chat-native
 * VibeChatView — Full-featured, embeddable React Native chat screen component.
 * Can be used standalone in React Navigation, embedded tabs, or inside the modal widget.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
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
  StatusBar,
  useColorScheme,
} from 'react-native';

import {
  VibeChatViewProps,
  VibeChatRef,
  Message,
  Conversation,
  ModelOption,
  StorageAdapter,
} from './types';
import { resolveTheme } from './theme';
import {
  InMemoryStorageAdapter,
  loadUserConversations,
  saveUserConversations,
  clearUserConversations,
} from './storage';
import { defaultOpenRouterTransport, ChatNetworkError } from './transport';
import { SafeClipboard } from './clipboard';

// ---------------------------------------------------------------------------
// Constants & Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: ModelOption[] = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
];

const DEFAULT_SUGGESTIONS = [
  '✨ What is Noblesse Tribe and how does it work?',
  '🧑‍💻 Help me write a clean React Native hook',
  '🌍 Translate "Welcome to our community" to 5 languages',
  '📖 Summarize key productivity strategies for teams',
];

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Subcomponents: TypingDots, ModelPicker, Sidebar
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
        ])
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
// VibeChatView Main Component
// ---------------------------------------------------------------------------

export const VibeChatView = forwardRef<VibeChatRef, VibeChatViewProps>(
  (props, ref) => {
    const {
      theme: userTheme,
      assistantName = 'Noblesse AI',
      welcomeTitle = 'How can I help you today?',
      welcomeSubtitle,
      assistantAvatar,
      userAvatar,
      placeholder = 'Ask anything…',
      disclaimer = 'AI can make mistakes. Verify important information.',
      suggestions = DEFAULT_SUGGESTIONS,
      openRouterKey = '',
      endpoint,
      headers,
      transport = defaultOpenRouterTransport,
      defaultModel = 'google/gemini-2.5-flash',
      models = DEFAULT_MODELS,
      userId,
      storage: propStorage,
      clipboard: propClipboard,
      showHeader = true,
      onClose,
      onError,
      onMessageSent,
      onResponseComplete,
      onConversationChange,
    } = props;

    // Theme resolution
    const systemScheme = useColorScheme() || 'light';
    const resolvedTheme = useMemo(
      () => resolveTheme(userTheme, systemScheme),
      [userTheme, systemScheme]
    );
    const { colors, typography, borderRadius, isDark } = resolvedTheme;

    // Storage and Clipboard adapters
    const storageRef = useRef<StorageAdapter>(
      propStorage || new InMemoryStorageAdapter()
    );
    useEffect(() => {
      if (propStorage) {
        storageRef.current = propStorage;
      }
    }, [propStorage]);

    const clipboardAdapter = useMemo(
      () => new SafeClipboard(propClipboard),
      [propClipboard]
    );

    // State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [model, setModel] = useState<string>(defaultModel);
    const [inputText, setInputText] = useState<string>('');
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const [isModelPickerOpen, setIsModelPickerOpen] = useState<boolean>(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    // Refs
    const flatListRef = useRef<FlatList<Message>>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastFailedTextRef = useRef<string | null>(null);

    // User scoping & Request lifecycle tracking refs
    const activeUserIdRef = useRef<string | undefined>(userId);
    activeUserIdRef.current = userId;
    const loadedUserIdRef = useRef<string | null>(null);
    const loadRequestIdRef = useRef<number>(0);

    // Active conversation
    const activeConversation = useMemo(
      () => conversations.find((c) => c.id === activeId) ?? null,
      [conversations, activeId]
    );
    const messages = useMemo(
      () => activeConversation?.messages ?? [],
      [activeConversation]
    );

    // Notify active conversation change
    useEffect(() => {
      onConversationChange?.(activeConversation);
    }, [activeConversation, onConversationChange]);

    // Abort active streaming request
    const abortStream = useCallback(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
    }, []);

    // Unmount and account switch cleanup: cancel active request
    useEffect(() => {
      return () => {
        abortStream();
      };
    }, [abortStream, userId]);

    // Race-proof Multi-Account / User Scoped Storage loader
    const loadHistoryForUser = useCallback(async () => {
      const targetScope = userId ?? '__guest__';
      const requestId = ++loadRequestIdRef.current;

      // 1. Cancel in-flight request when user changes
      abortStream();

      // 2. Invalidate loaded state & clear in-memory conversations immediately
      // to guarantee stale data from previous user is never displayed or saved
      loadedUserIdRef.current = null;
      setIsInitialized(false);
      setConversations([]);
      setActiveId(null);

      try {
        const loaded = await loadUserConversations(storageRef.current, userId);

        // 3. Stale check: discard if user switched again before this resolved
        if (
          requestId !== loadRequestIdRef.current ||
          targetScope !== (activeUserIdRef.current ?? '__guest__')
        ) {
          return;
        }

        setConversations(loaded);
        setActiveId(loaded.length > 0 ? loaded[0].id : null);
        loadedUserIdRef.current = targetScope;
      } catch (err: unknown) {
        console.warn('[VibeChat] Failed to load history:', err);
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setIsInitialized(true);
        }
      }
    }, [userId, abortStream]);

    // Re-load when userId or storage changes
    useEffect(() => {
      loadHistoryForUser();
    }, [loadHistoryForUser]);

    // Save conversations when updated — strictly guarded by loaded user ID check
    useEffect(() => {
      const currentScope = userId ?? '__guest__';
      // ONLY persist if the in-memory conversations strictly belong to the current user scope!
      // This completely prevents writing User A's data into User B's namespace.
      if (loadedUserIdRef.current === currentScope && isInitialized) {
        saveUserConversations(storageRef.current, conversations, userId);
      }
    }, [conversations, isInitialized, userId]);

    // Auto-scroll on new messages or chunk updates
    useEffect(() => {
      if (messages.length > 0) {
        const timer = setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 60);
        return () => clearTimeout(timer);
      }
    }, [messages.length, isStreaming]);

    // Clear history
    const handleClearHistory = useCallback(async () => {
      await clearUserConversations(storageRef.current, userId);
      setConversations([]);
      setActiveId(null);
    }, [userId]);

    // Send Message Implementation
    const executeSend = useCallback(
      async (textToSend: string) => {
        const cleanText = textToSend.trim();
        if (!cleanText || isStreaming) return;

        // Abort previous stream if any
        abortStream();

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const requestUserId = userId;
        const requestScope = userId ?? '__guest__';

        const isNewConv = !activeId;
        const convId = isNewConv ? uid() : (activeId as string);
        const userMsg: Message = {
          id: uid(),
          role: 'user',
          content: cleanText,
          timestamp: Date.now(),
        };

        lastFailedTextRef.current = cleanText;

        const priorMessages = activeConversation?.messages ?? [];

        // Update state with user message
        setConversations((prev) => {
          if (isNewConv) {
            const newConv: Conversation = {
              id: convId,
              title: cleanText.slice(0, 40),
              messages: [userMsg],
              updatedAt: Date.now(),
              userId: requestUserId,
            };
            return [newConv, ...prev];
          }
          return prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: [...c.messages, userMsg],
                  updatedAt: Date.now(),
                }
              : c
          );
        });

        if (isNewConv) {
          setActiveId(convId);
        }

        setInputText('');
        setIsStreaming(true);
        onMessageSent?.(userMsg);

        const assistantMsgId = uid();
        let assistantMessageCreated = false;

        try {
          const payloadMessages = [...priorMessages, userMsg]
            .filter((m) => m.role !== 'error')
            .slice(-30)
            .map((m) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            }));

          // Insert empty assistant bubble
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: [
                      ...c.messages,
                      {
                        id: assistantMsgId,
                        role: 'assistant',
                        content: '',
                        timestamp: Date.now(),
                      },
                    ],
                  }
                : c
            )
          );
          assistantMessageCreated = true;

          const finalContent = await transport(
            {
              model,
              messages: payloadMessages,
              stream: true,
              signal: controller.signal,
              headers,
              endpoint,
              apiKey: openRouterKey,
            },
            (currentChunk: string) => {
              // Stale check: Drop chunk if user changed accounts or request was cancelled
              if (
                activeUserIdRef.current !== requestUserId ||
                controller.signal.aborted
              ) {
                return;
              }

              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== convId) return c;
                  const msgs = [...c.messages];
                  const lastIdx = msgs.length - 1;
                  if (msgs[lastIdx]?.id === assistantMsgId) {
                    msgs[lastIdx] = {
                      ...msgs[lastIdx],
                      content: currentChunk,
                    };
                  }
                  return { ...c, messages: msgs, updatedAt: Date.now() };
                })
              );
            }
          );

          // Stale check: Discard if user switched away before completion
          if (
            activeUserIdRef.current !== requestUserId ||
            controller.signal.aborted
          ) {
            return;
          }

          lastFailedTextRef.current = null;
          onResponseComplete?.({
            id: assistantMsgId,
            role: 'assistant',
            content: finalContent,
            timestamp: Date.now(),
          });
        } catch (err: unknown) {
          // If request was aborted because user switched accounts or stopped manually
          const isCancelled =
            controller.signal.aborted ||
            (err instanceof ChatNetworkError && err.isCancelled);

          if (isCancelled) {
            return;
          }

          // Discard if user switched accounts while request was pending
          if (activeUserIdRef.current !== requestUserId) {
            return;
          }

          const errorMsg =
            err instanceof Error ? err.message : 'Network error occurred.';
          onError?.(err instanceof Error ? err : new Error(errorMsg));

          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== convId) return c;
              const msgs = [...c.messages];
              // If empty assistant bubble was created, remove it or replace with error
              if (
                assistantMessageCreated &&
                msgs[msgs.length - 1]?.id === assistantMsgId &&
                !msgs[msgs.length - 1].content.trim()
              ) {
                msgs.pop();
              }
              return {
                ...c,
                messages: [
                  ...msgs,
                  {
                    id: uid(),
                    role: 'error',
                    content: errorMsg,
                    rawError: errorMsg,
                    timestamp: Date.now(),
                  },
                ],
                updatedAt: Date.now(),
              };
            })
          );
        } finally {
          setIsStreaming(false);
          abortControllerRef.current = null;
        }
      },
      [
        isStreaming,
        activeId,
        activeConversation,
        userId,
        onMessageSent,
        transport,
        model,
        headers,
        endpoint,
        openRouterKey,
        onResponseComplete,
        onError,
        abortStream,
      ]
    );

    // Forwarded Ref
    useImperativeHandle(
      ref,
      () => ({
        open: () => {},
        close: () => onClose?.(),
        isOpen: () => true,
        sendMessage: (text: string) => executeSend(text),
        abort: abortStream,
        clearHistory: handleClearHistory,
        newChat: () => setActiveId(null),
      }),
      [executeSend, abortStream, handleClearHistory, onClose]
    );

    // Copy Handler
    const handleCopy = useCallback(
      async (msgId: string, content: string) => {
        await clipboardAdapter.setString(content);
        setCopiedMessageId(msgId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      },
      [clipboardAdapter]
    );

    // Retry Handler
    const handleRetry = useCallback(() => {
      if (lastFailedTextRef.current) {
        executeSend(lastFailedTextRef.current);
      }
    }, [executeSend]);

    // Model label
    const activeModelLabel = useMemo(
      () => models.find((m) => m.id === model)?.label ?? model,
      [models, model]
    );

    if (!isInitialized) {
      return (
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />

        {/* ── Top Header ────────────────────────────────────────── */}
        {showHeader && (
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            {/* Sidebar toggle */}
            <TouchableOpacity
              onPress={() => setIsSidebarOpen(true)}
              style={styles.headerIconButton}
              accessibilityLabel="Open conversation history"
            >
              <View style={styles.hamburger}>
                <View
                  style={[
                    styles.hamburgerLine,
                    { backgroundColor: colors.text },
                  ]}
                />
                <View
                  style={[
                    styles.hamburgerLine,
                    { backgroundColor: colors.text, width: 14 },
                  ]}
                />
                <View
                  style={[
                    styles.hamburgerLine,
                    { backgroundColor: colors.text },
                  ]}
                />
              </View>
            </TouchableOpacity>

            {/* Title & Live Status */}
            <View style={styles.headerTitleWrap}>
              <Text
                style={[
                  styles.headerTitle,
                  {
                    color: colors.text,
                    fontSize: typography.headerFontSize,
                    fontFamily: typography.fontFamily,
                  },
                ]}
                numberOfLines={1}
              >
                {assistantName}
              </Text>
              <View
                style={[styles.onlineDot, { backgroundColor: colors.accent }]}
              />
            </View>

            {/* Close Button */}
            {onClose ? (
              <TouchableOpacity
                onPress={onClose}
                style={styles.headerIconButton}
                accessibilityLabel="Close chat"
              >
                <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerIconButton} />
            )}
          </View>
        )}

        {/* ── Chat Messages & Input ─────────────────────────────── */}
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {messages.length === 0 ? (
            /* ── Empty State ───────────────────────────────────── */
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.avatarOrb,
                  {
                    backgroundColor: colors.primary + '18',
                    borderColor: colors.primary + '44',
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                {assistantAvatar ? (
                  assistantAvatar
                ) : (
                  <Text style={[styles.avatarOrbText, { color: colors.primary }]}>
                    ✦
                  </Text>
                )}
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: colors.text,
                    fontFamily: typography.fontFamily,
                  },
                ]}
              >
                {welcomeTitle}
              </Text>

              <Text
                style={[
                  styles.emptySubtitle,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamily,
                  },
                ]}
              >
                {welcomeSubtitle ||
                  `Powered by ${activeModelLabel}. Ask a question or pick a starter below.`}
              </Text>

              <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                    onPress={() => executeSend(suggestion)}
                  >
                    <Text
                      style={[
                        styles.suggestionText,
                        {
                          color: colors.text,
                          fontFamily: typography.fontFamily,
                        },
                      ]}
                    >
                      {suggestion}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            /* ── Messages List ─────────────────────────────────── */
            <FlatList<Message>
              ref={flatListRef}
              data={messages}
              keyExtractor={(item: Message) => item.id}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }: { item: Message }) => {
                const isUser = item.role === 'user';
                const isError = item.role === 'error';

                return (
                  <View
                    style={[
                      styles.bubbleRow,
                      isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                    ]}
                  >
                    {/* Assistant Avatar */}
                    {!isUser && (
                      <View
                        style={[
                          styles.smallAvatar,
                          {
                            backgroundColor: colors.secondary + '24',
                            borderRadius: borderRadius.full,
                          },
                        ]}
                      >
                        {assistantAvatar ? (
                          assistantAvatar
                        ) : (
                          <Text
                            style={[
                              styles.smallAvatarText,
                              { color: colors.secondary },
                            ]}
                          >
                            AI
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Bubble */}
                    <View
                      style={[
                        styles.bubble,
                        {
                          borderRadius: borderRadius.bubble,
                          backgroundColor: isUser
                            ? colors.userBubbleBackground
                            : isError
                            ? colors.errorBackground
                            : colors.assistantBubbleBackground,
                          borderColor: isError ? colors.errorText + '44' : colors.border,
                          borderWidth: isUser ? 0 : 1,
                        },
                        isUser
                          ? styles.bubbleUserCorner
                          : styles.bubbleAssistantCorner,
                      ]}
                    >
                      <Text
                        selectable
                        style={[
                          styles.bubbleText,
                          {
                            color: isUser
                              ? colors.userBubbleText
                              : isError
                              ? colors.errorText
                              : colors.assistantBubbleText,
                            fontSize: typography.bodyFontSize,
                            lineHeight: typography.lineHeight,
                            fontFamily: typography.fontFamily,
                          },
                        ]}
                      >
                        {item.content || (isStreaming ? 'Thinking…' : '')}
                      </Text>

                      {/* Assistant Actions: Copy button */}
                      {!isUser && !isError && item.content.length > 0 && (
                        <TouchableOpacity
                          onPress={() => handleCopy(item.id, item.content)}
                          style={styles.copyButton}
                          accessibilityLabel="Copy response"
                        >
                          <Text
                            style={[
                              styles.copyButtonText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {copiedMessageId === item.id
                              ? '✓ Copied'
                              : '⎘ Copy'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Error Retry Button */}
                      {isError && (
                        <TouchableOpacity
                          onPress={handleRetry}
                          style={[
                            styles.retryButton,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.errorText + '55',
                              borderRadius: borderRadius.sm,
                            },
                          ]}
                          accessibilityLabel="Retry failed message"
                        >
                          <Text
                            style={[
                              styles.retryButtonText,
                              { color: colors.errorText },
                            ]}
                          >
                            ↺ Retry
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* User Avatar */}
                    {isUser && (
                      <View
                        style={[
                          styles.smallAvatar,
                          {
                            backgroundColor: colors.primary,
                            borderRadius: borderRadius.full,
                          },
                        ]}
                      >
                        {userAvatar ? (
                          userAvatar
                        ) : (
                          <Text style={styles.userAvatarText}>U</Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              }}
              ListFooterComponent={
                isStreaming ? (
                  <View style={styles.streamingIndicatorRow}>
                    <View
                      style={[
                        styles.smallAvatar,
                        {
                          backgroundColor: colors.secondary + '24',
                          borderRadius: borderRadius.full,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.smallAvatarText,
                          { color: colors.secondary },
                        ]}
                      >
                        AI
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.streamingBubble,
                        {
                          backgroundColor: colors.assistantBubbleBackground,
                          borderRadius: borderRadius.bubble,
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <TypingDots color={colors.accent || colors.primary} />
                    </View>
                  </View>
                ) : null
              }
            />
          )}

          {/* ── Input Bar ────────────────────────────────────────── */}
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            {/* Model Badge */}
            <TouchableOpacity
              onPress={() => setIsModelPickerOpen(true)}
              style={[
                styles.modelBadge,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  borderRadius: borderRadius.full,
                },
              ]}
              accessibilityLabel="Switch AI Model"
            >
              <Text
                style={[
                  styles.modelBadgeText,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamily,
                  },
                ]}
              >
                ⚡ {activeModelLabel} ▾
              </Text>
            </TouchableOpacity>

            {/* Input Row */}
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: colors.text,
                    fontSize: typography.bodyFontSize,
                    fontFamily: typography.fontFamily,
                  },
                ]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={4000}
                editable={!isStreaming}
              />

              {/* Action Button: Send or Stop */}
              {isStreaming ? (
                <TouchableOpacity
                  onPress={abortStream}
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor: colors.errorBackground,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                  accessibilityLabel="Stop generating"
                >
                  <Text style={[styles.stopIcon, { color: colors.errorText }]}>
                    ■
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => executeSend(inputText)}
                  disabled={!inputText.trim()}
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor: inputText.trim()
                        ? colors.sendButtonBackground
                        : colors.sendButtonBackground + '44',
                      borderRadius: borderRadius.full,
                    },
                  ]}
                  accessibilityLabel="Send message"
                >
                  <Text
                    style={[
                      styles.sendIcon,
                      { color: colors.sendButtonIcon },
                    ]}
                  >
                    ↑
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Legal Disclaimer */}
            {disclaimer ? (
              <Text
                style={[
                  styles.disclaimerText,
                  {
                    color: colors.textMuted,
                    fontSize: typography.smallFontSize,
                    fontFamily: typography.fontFamily,
                  },
                ]}
              >
                {disclaimer}
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>

        {/* ── Slide-in Sidebar Drawer ───────────────────────────── */}
        {isSidebarOpen && (
          <Pressable
            style={styles.backdrop}
            onPress={() => setIsSidebarOpen(false)}
          />
        )}
        {isSidebarOpen && (
          <View
            style={[
              styles.sidebar,
              {
                backgroundColor: colors.surface,
                borderRightColor: colors.border,
              },
            ]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <View
                style={[
                  styles.sidebarHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.sidebarTitle,
                    {
                      color: colors.text,
                      fontFamily: typography.fontFamily,
                    },
                  ]}
                >
                  Chats
                </Text>
                <TouchableOpacity
                  onPress={() => setIsSidebarOpen(false)}
                  style={styles.sidebarClose}
                >
                  <Text
                    style={[
                      styles.sidebarCloseText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.newChatButton,
                  {
                    borderColor: colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={() => {
                  setActiveId(null);
                  setIsSidebarOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.newChatButtonText,
                    { color: colors.primary },
                  ]}
                >
                  ＋  New Chat
                </Text>
              </TouchableOpacity>

              <FlatList<Conversation>
                data={conversations}
                keyExtractor={(item: Conversation) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }: { item: Conversation }) => (
                  <View
                    style={[
                      styles.convRow,
                      activeId === item.id && {
                        backgroundColor: colors.surfaceSecondary,
                      },
                      { borderRadius: borderRadius.sm },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.convContent}
                      onPress={() => {
                        setActiveId(item.id);
                        setIsSidebarOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.convTitle,
                          {
                            color:
                              activeId === item.id
                                ? colors.primary
                                : colors.text,
                            fontFamily: typography.fontFamily,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.convDate,
                          { color: colors.textMuted },
                        ]}
                      >
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Delete Conversation',
                          'Are you sure you want to delete this chat?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                setConversations((prev) =>
                                  prev.filter((c) => c.id !== item.id)
                                );
                                if (activeId === item.id) {
                                  setActiveId(null);
                                }
                              },
                            },
                          ]
                        );
                      }}
                      style={styles.deleteButton}
                    >
                      <Text style={{ color: colors.textMuted }}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={
                  <Text
                    style={[
                      styles.emptyConvText,
                      { color: colors.textMuted },
                    ]}
                  >
                    No saved chats yet.
                  </Text>
                }
              />
            </SafeAreaView>
          </View>
        )}

        {/* ── Model Picker Modal ────────────────────────────────── */}
        <Modal
          visible={isModelPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsModelPickerOpen(false)}
        >
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setIsModelPickerOpen(false)}
          >
            <View
              style={[
                styles.pickerSheet,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.pickerTitle,
                  { color: colors.textSecondary },
                ]}
              >
                Select AI Model
              </Text>
              {models.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.pickerItem,
                    model === m.id && {
                      backgroundColor: colors.surfaceSecondary,
                    },
                    { borderRadius: borderRadius.sm },
                  ]}
                  onPress={() => {
                    setModel(m.id);
                    setIsModelPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      {
                        color:
                          model === m.id ? colors.primary : colors.text,
                        fontWeight: model === m.id ? '700' : '400',
                      },
                    ]}
                  >
                    {m.label}
                  </Text>
                  {model === m.id && (
                    <Text
                      style={[styles.checkmark, { color: colors.primary }]}
                    >
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );
  }
);

VibeChatView.displayName = 'VibeChatView';

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburger: {
    gap: 4,
  },
  hamburgerLine: {
    height: 2,
    width: 18,
    borderRadius: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '600',
  },
  keyboardContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  avatarOrb: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  avatarOrbText: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  suggestionsContainer: {
    width: '100%',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  messageList: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  smallAvatar: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    fontSize: 11,
    fontWeight: '800',
  },
  userAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bubble: {
    maxWidth: SCREEN_WIDTH * 0.76,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUserCorner: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistantCorner: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {},
  copyButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  streamingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  streamingBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  inputBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 12,
    borderTopWidth: 1,
    gap: 8,
  },
  modelBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  modelBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    lineHeight: 20,
  },
  sendButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendIcon: {
    fontSize: 17,
    fontWeight: '700',
  },
  stopIcon: {
    fontSize: 14,
  },
  disclaimerText: {
    textAlign: 'center',
    paddingBottom: 2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 98,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    borderRightWidth: 1,
    zIndex: 99,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sidebarTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sidebarClose: {
    padding: 4,
  },
  sidebarCloseText: {
    fontSize: 16,
  },
  newChatButton: {
    margin: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  newChatButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  convContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  convTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  convDate: {
    fontSize: 11,
  },
  deleteButton: {
    padding: 10,
  },
  emptyConvText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
  pickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  pickerItemText: {
    fontSize: 15,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
  },
});
