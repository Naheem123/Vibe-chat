"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VibeChatView = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * @noblesse/vibe-chat-native
 * VibeChatView — Full-featured, embeddable React Native chat screen component.
 * Can be used standalone in React Navigation, embedded tabs, or inside the modal widget.
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const theme_1 = require("./theme");
const storage_1 = require("./storage");
const transport_1 = require("./transport");
const clipboard_1 = require("./clipboard");
// ---------------------------------------------------------------------------
// Constants & Defaults
// ---------------------------------------------------------------------------
const DEFAULT_MODELS = [
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
function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
// ---------------------------------------------------------------------------
// Subcomponents: TypingDots, ModelPicker, Sidebar
// ---------------------------------------------------------------------------
function TypingDots({ color }) {
    const dot1 = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    const dot2 = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    const dot3 = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    (0, react_1.useEffect)(() => {
        const bounce = (dot, delay) => react_native_1.Animated.loop(react_native_1.Animated.sequence([
            react_native_1.Animated.delay(delay),
            react_native_1.Animated.timing(dot, {
                toValue: -6,
                duration: 300,
                easing: react_native_1.Easing.inOut(react_native_1.Easing.ease),
                useNativeDriver: true,
            }),
            react_native_1.Animated.timing(dot, {
                toValue: 0,
                duration: 300,
                easing: react_native_1.Easing.inOut(react_native_1.Easing.ease),
                useNativeDriver: true,
            }),
        ]));
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
    const dotStyle = (anim) => ({
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: color,
        marginHorizontal: 2,
        transform: [{ translateY: anim }],
    });
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.typingRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: dotStyle(dot1) }), (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: dotStyle(dot2) }), (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: dotStyle(dot3) })] }));
}
// ---------------------------------------------------------------------------
// VibeChatView Main Component
// ---------------------------------------------------------------------------
exports.VibeChatView = (0, react_1.forwardRef)((props, ref) => {
    const { theme: userTheme, assistantName = 'Noblesse AI', welcomeTitle = 'How can I help you today?', welcomeSubtitle, assistantAvatar, userAvatar, placeholder = 'Ask anything…', disclaimer = 'AI can make mistakes. Verify important information.', suggestions = DEFAULT_SUGGESTIONS, openRouterKey = '', endpoint, headers, transport = transport_1.defaultOpenRouterTransport, defaultModel = 'google/gemini-2.5-flash', models = DEFAULT_MODELS, userId, storage: propStorage, clipboard: propClipboard, showHeader = true, onClose, onError, onMessageSent, onResponseComplete, onConversationChange, } = props;
    // Theme resolution
    const systemScheme = (0, react_native_1.useColorScheme)() || 'light';
    const resolvedTheme = (0, react_1.useMemo)(() => (0, theme_1.resolveTheme)(userTheme, systemScheme), [userTheme, systemScheme]);
    const { colors, typography, borderRadius, isDark } = resolvedTheme;
    // Storage and Clipboard adapters
    const storageRef = (0, react_1.useRef)(propStorage || new storage_1.InMemoryStorageAdapter());
    (0, react_1.useEffect)(() => {
        if (propStorage) {
            storageRef.current = propStorage;
        }
    }, [propStorage]);
    const clipboardAdapter = (0, react_1.useMemo)(() => new clipboard_1.SafeClipboard(propClipboard), [propClipboard]);
    // State
    const [conversations, setConversations] = (0, react_1.useState)([]);
    const [activeId, setActiveId] = (0, react_1.useState)(null);
    const [model, setModel] = (0, react_1.useState)(defaultModel);
    const [inputText, setInputText] = (0, react_1.useState)('');
    const [isStreaming, setIsStreaming] = (0, react_1.useState)(false);
    const [isSidebarOpen, setIsSidebarOpen] = (0, react_1.useState)(false);
    const [isModelPickerOpen, setIsModelPickerOpen] = (0, react_1.useState)(false);
    const [copiedMessageId, setCopiedMessageId] = (0, react_1.useState)(null);
    // ── 1. Account-Scoped Initialization State ─────────────────────────────
    // Tracks the exact user ID for which in-memory conversations are loaded.
    // null indicates that account switching or initial loading is in progress.
    const [initializedForUserId, setInitializedForUserId] = (0, react_1.useState)(null);
    // Refs
    const flatListRef = (0, react_1.useRef)(null);
    const abortControllerRef = (0, react_1.useRef)(null);
    const lastFailedTextRef = (0, react_1.useRef)(null);
    // Track active userId synchronously in a ref
    const activeUserIdRef = (0, react_1.useRef)(userId);
    activeUserIdRef.current = userId;
    // Monotonic request ID counter for ignoring stale asynchronous loads
    const loadRequestIdRef = (0, react_1.useRef)(0);
    // Track the user ID that initiated the active streaming request
    const streamingUserIdRef = (0, react_1.useRef)(null);
    // Active conversation
    const activeConversation = (0, react_1.useMemo)(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);
    const messages = (0, react_1.useMemo)(() => activeConversation?.messages ?? [], [activeConversation]);
    // Notify active conversation change
    (0, react_1.useEffect)(() => {
        onConversationChange?.(activeConversation);
    }, [activeConversation, onConversationChange]);
    // Abort active streaming request
    const abortStream = (0, react_1.useCallback)(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        streamingUserIdRef.current = null;
        setIsStreaming(false);
    }, []);
    // ── 2. Request Lifecycle: Cancel on Unmount & Account Switch ────────────
    (0, react_1.useEffect)(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            streamingUserIdRef.current = null;
            setIsStreaming(false);
        };
    }, []);
    // ── 3. Account-Scoped History Loader (Ignore Stale Async Results) ────────
    (0, react_1.useEffect)(() => {
        const targetScope = userId ?? '__guest__';
        const requestId = ++loadRequestIdRef.current;
        // 3.1. Immediately abort any in-flight request when user changes
        abortStream();
        // 3.2. Immediately mark account as uninitialized and wipe in-memory state
        // so stale data from the previous account is never held, displayed, or persisted!
        setInitializedForUserId(null);
        setConversations([]);
        setActiveId(null);
        let isCurrent = true;
        (0, storage_1.loadUserConversations)(storageRef.current, userId)
            .then((loaded) => {
            // 3.3. Stale check: Discard if user switched again before this async read resolved
            if (!isCurrent ||
                requestId !== loadRequestIdRef.current ||
                targetScope !== (activeUserIdRef.current ?? '__guest__')) {
                return;
            }
            setConversations(loaded);
            setActiveId(loaded.length > 0 ? loaded[0].id : null);
            setInitializedForUserId(targetScope);
        })
            .catch((err) => {
            console.warn('[VibeChat] Failed to load history:', err);
            if (isCurrent &&
                requestId === loadRequestIdRef.current &&
                targetScope === (activeUserIdRef.current ?? '__guest__')) {
                setConversations([]);
                setActiveId(null);
                setInitializedForUserId(targetScope);
            }
        });
        return () => {
            isCurrent = false;
            abortStream();
        };
    }, [userId, abortStream]);
    // ── 4. Account-Scoped Persistence Effect ────────────────────────────────
    (0, react_1.useEffect)(() => {
        const currentScope = userId ?? '__guest__';
        // CRITICAL REQUIREMENT:
        // Only persist if initializedForUserId strictly matches currentScope!
        // When switching accounts, initializedForUserId is null until the new user's own history
        // has finished loading and populated conversations. This prevents writing User A's data
        // into User B's namespace.
        if (initializedForUserId === currentScope) {
            (0, storage_1.saveUserConversations)(storageRef.current, conversations, userId);
        }
    }, [conversations, initializedForUserId, userId]);
    // Auto-scroll on new messages or chunk updates
    (0, react_1.useEffect)(() => {
        if (messages.length > 0) {
            const timer = setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [messages.length, isStreaming]);
    // Clear history for active user
    const handleClearHistory = (0, react_1.useCallback)(async () => {
        await (0, storage_1.clearUserConversations)(storageRef.current, userId);
        setConversations([]);
        setActiveId(null);
    }, [userId]);
    // Send Message Implementation
    const executeSend = (0, react_1.useCallback)(async (textToSend) => {
        const cleanText = textToSend.trim();
        if (!cleanText || isStreaming)
            return;
        // Abort previous stream if any
        abortStream();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const requestUserId = userId;
        const requestScope = userId ?? '__guest__';
        streamingUserIdRef.current = requestScope;
        const isNewConv = !activeId;
        const convId = isNewConv ? uid() : activeId;
        const userMsg = {
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
                const newConv = {
                    id: convId,
                    title: cleanText.slice(0, 40),
                    messages: [userMsg],
                    updatedAt: Date.now(),
                    userId: requestUserId,
                };
                return [newConv, ...prev];
            }
            return prev.map((c) => c.id === convId
                ? {
                    ...c,
                    messages: [...c.messages, userMsg],
                    updatedAt: Date.now(),
                }
                : c);
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
                role: m.role,
                content: m.content,
            }));
            // Insert empty assistant bubble
            setConversations((prev) => prev.map((c) => c.id === convId
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
                : c));
            assistantMessageCreated = true;
            const finalContent = await transport({
                model,
                messages: payloadMessages,
                stream: true,
                signal: controller.signal,
                headers,
                endpoint,
                apiKey: openRouterKey,
            }, (currentChunk) => {
                // Stale check: Drop chunk if user changed accounts or request was cancelled
                if (controller.signal.aborted ||
                    (activeUserIdRef.current ?? '__guest__') !== requestScope ||
                    streamingUserIdRef.current !== requestScope) {
                    return;
                }
                setConversations((prev) => prev.map((c) => {
                    if (c.id !== convId)
                        return c;
                    const msgs = [...c.messages];
                    const lastIdx = msgs.length - 1;
                    if (msgs[lastIdx]?.id === assistantMsgId) {
                        msgs[lastIdx] = {
                            ...msgs[lastIdx],
                            content: currentChunk,
                        };
                    }
                    return { ...c, messages: msgs, updatedAt: Date.now() };
                }));
            });
            // Stale check: Discard if user switched away before completion
            if (controller.signal.aborted ||
                (activeUserIdRef.current ?? '__guest__') !== requestScope ||
                streamingUserIdRef.current !== requestScope) {
                return;
            }
            lastFailedTextRef.current = null;
            onResponseComplete?.({
                id: assistantMsgId,
                role: 'assistant',
                content: finalContent,
                timestamp: Date.now(),
            });
        }
        catch (err) {
            // If request was aborted because user switched accounts or stopped manually
            const isCancelled = controller.signal.aborted ||
                (err instanceof transport_1.ChatNetworkError && err.isCancelled);
            if (isCancelled) {
                return;
            }
            // Discard if user switched accounts while request was pending
            if ((activeUserIdRef.current ?? '__guest__') !== requestScope) {
                return;
            }
            const errorMsg = err instanceof Error ? err.message : 'Network error occurred.';
            onError?.(err instanceof Error ? err : new Error(errorMsg));
            setConversations((prev) => prev.map((c) => {
                if (c.id !== convId)
                    return c;
                const msgs = [...c.messages];
                // If empty assistant bubble was created, remove it or replace with error
                if (assistantMessageCreated &&
                    msgs[msgs.length - 1]?.id === assistantMsgId &&
                    !msgs[msgs.length - 1].content.trim()) {
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
            }));
        }
        finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
            streamingUserIdRef.current = null;
        }
    }, [
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
    ]);
    // Forwarded Ref
    (0, react_1.useImperativeHandle)(ref, () => ({
        open: () => { },
        close: () => onClose?.(),
        isOpen: () => true,
        sendMessage: (text) => executeSend(text),
        abort: abortStream,
        clearHistory: handleClearHistory,
        newChat: () => setActiveId(null),
    }), [executeSend, abortStream, handleClearHistory, onClose]);
    // Copy Handler
    const handleCopy = (0, react_1.useCallback)(async (msgId, content) => {
        await clipboardAdapter.setString(content);
        setCopiedMessageId(msgId);
        setTimeout(() => setCopiedMessageId(null), 2000);
    }, [clipboardAdapter]);
    // Retry Handler
    const handleRetry = (0, react_1.useCallback)(() => {
        if (lastFailedTextRef.current) {
            executeSend(lastFailedTextRef.current);
        }
    }, [executeSend]);
    // Model label
    const activeModelLabel = (0, react_1.useMemo)(() => models.find((m) => m.id === model)?.label ?? model, [models, model]);
    const isCurrentAccountInitialized = initializedForUserId === (userId ?? '__guest__');
    if (!isCurrentAccountInitialized) {
        return ((0, jsx_runtime_1.jsx)(react_native_1.SafeAreaView, { style: [styles.container, { backgroundColor: colors.background }], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.centerContainer, children: (0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { size: "large", color: colors.primary }) }) }));
    }
    return ((0, jsx_runtime_1.jsxs)(react_native_1.SafeAreaView, { style: [styles.container, { backgroundColor: colors.background }], children: [(0, jsx_runtime_1.jsx)(react_native_1.StatusBar, { barStyle: isDark ? 'light-content' : 'dark-content', backgroundColor: colors.background }), showHeader && ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
                    styles.header,
                    {
                        backgroundColor: colors.surface,
                        borderBottomColor: colors.border,
                    },
                ], children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => setIsSidebarOpen(true), style: styles.headerIconButton, accessibilityLabel: "Open conversation history", children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.hamburger, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                        styles.hamburgerLine,
                                        { backgroundColor: colors.text },
                                    ] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                        styles.hamburgerLine,
                                        { backgroundColor: colors.text, width: 14 },
                                    ] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                        styles.hamburgerLine,
                                        { backgroundColor: colors.text },
                                    ] })] }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.headerTitleWrap, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                    styles.headerTitle,
                                    {
                                        color: colors.text,
                                        fontSize: typography.headerFontSize,
                                        fontFamily: typography.fontFamily,
                                    },
                                ], numberOfLines: 1, children: assistantName }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [styles.onlineDot, { backgroundColor: colors.accent }] })] }), onClose ? ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: onClose, style: styles.headerIconButton, accessibilityLabel: "Close chat", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.closeIcon, { color: colors.textSecondary }], children: "\u2715" }) })) : ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.headerIconButton }))] })), (0, jsx_runtime_1.jsxs)(react_native_1.KeyboardAvoidingView, { style: styles.keyboardContainer, behavior: react_native_1.Platform.OS === 'ios' ? 'padding' : undefined, keyboardVerticalOffset: react_native_1.Platform.OS === 'ios' ? 10 : 0, children: [messages.length === 0 ? (
                    /* ── Empty State ───────────────────────────────────── */
                    (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.emptyContainer, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                    styles.avatarOrb,
                                    {
                                        backgroundColor: colors.primary + '18',
                                        borderColor: colors.primary + '44',
                                        borderRadius: borderRadius.full,
                                    },
                                ], children: assistantAvatar ? (assistantAvatar) : ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.avatarOrbText, { color: colors.primary }], children: "\u2726" })) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                    styles.emptyTitle,
                                    {
                                        color: colors.text,
                                        fontFamily: typography.fontFamily,
                                    },
                                ], children: welcomeTitle }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                    styles.emptySubtitle,
                                    {
                                        color: colors.textSecondary,
                                        fontFamily: typography.fontFamily,
                                    },
                                ], children: welcomeSubtitle ||
                                    `Powered by ${activeModelLabel}. Ask a question or pick a starter below.` }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.suggestionsContainer, children: suggestions.map((suggestion, index) => ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: [
                                        styles.suggestionChip,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: colors.border,
                                            borderRadius: borderRadius.md,
                                        },
                                    ], onPress: () => executeSend(suggestion), children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                            styles.suggestionText,
                                            {
                                                color: colors.text,
                                                fontFamily: typography.fontFamily,
                                            },
                                        ], children: suggestion }) }, index))) })] })) : (
                    /* ── Messages List ─────────────────────────────────── */
                    (0, jsx_runtime_1.jsx)(react_native_1.FlatList, { ref: flatListRef, data: messages, keyExtractor: (item) => item.id, contentContainerStyle: styles.messageList, showsVerticalScrollIndicator: false, renderItem: ({ item }) => {
                            const isUser = item.role === 'user';
                            const isError = item.role === 'error';
                            return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
                                    styles.bubbleRow,
                                    isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                                ], children: [!isUser && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                            styles.smallAvatar,
                                            {
                                                backgroundColor: colors.secondary + '24',
                                                borderRadius: borderRadius.full,
                                            },
                                        ], children: assistantAvatar ? (assistantAvatar) : ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                                styles.smallAvatarText,
                                                { color: colors.secondary },
                                            ], children: "AI" })) })), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
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
                                        ], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { selectable: true, style: [
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
                                                ], children: item.content || (isStreaming ? 'Thinking…' : '') }), !isUser && !isError && item.content.length > 0 && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => handleCopy(item.id, item.content), style: styles.copyButton, accessibilityLabel: "Copy response", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                                        styles.copyButtonText,
                                                        { color: colors.textSecondary },
                                                    ], children: copiedMessageId === item.id
                                                        ? '✓ Copied'
                                                        : '⎘ Copy' }) })), isError && ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: handleRetry, style: [
                                                    styles.retryButton,
                                                    {
                                                        backgroundColor: colors.surface,
                                                        borderColor: colors.errorText + '55',
                                                        borderRadius: borderRadius.sm,
                                                    },
                                                ], accessibilityLabel: "Retry failed message", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                                        styles.retryButtonText,
                                                        { color: colors.errorText },
                                                    ], children: "\u21BA Retry" }) }))] }), isUser && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                            styles.smallAvatar,
                                            {
                                                backgroundColor: colors.primary,
                                                borderRadius: borderRadius.full,
                                            },
                                        ], children: userAvatar ? (userAvatar) : ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.userAvatarText, children: "U" })) }))] }));
                        }, ListFooterComponent: isStreaming ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.streamingIndicatorRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                        styles.smallAvatar,
                                        {
                                            backgroundColor: colors.secondary + '24',
                                            borderRadius: borderRadius.full,
                                        },
                                    ], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                            styles.smallAvatarText,
                                            { color: colors.secondary },
                                        ], children: "AI" }) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                        styles.streamingBubble,
                                        {
                                            backgroundColor: colors.assistantBubbleBackground,
                                            borderRadius: borderRadius.bubble,
                                            borderColor: colors.border,
                                            borderWidth: 1,
                                        },
                                    ], children: (0, jsx_runtime_1.jsx)(TypingDots, { color: colors.accent || colors.primary }) })] })) : null })), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
                            styles.inputBar,
                            {
                                backgroundColor: colors.surface,
                                borderTopColor: colors.border,
                            },
                        ], children: [(0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => setIsModelPickerOpen(true), style: [
                                    styles.modelBadge,
                                    {
                                        backgroundColor: colors.surfaceSecondary,
                                        borderColor: colors.border,
                                        borderRadius: borderRadius.full,
                                    },
                                ], accessibilityLabel: "Switch AI Model", children: (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [
                                        styles.modelBadgeText,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: typography.fontFamily,
                                        },
                                    ], children: ["\u26A1 ", activeModelLabel, " \u25BE"] }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
                                    styles.inputRow,
                                    {
                                        backgroundColor: colors.background,
                                        borderColor: colors.border,
                                        borderRadius: borderRadius.lg,
                                    },
                                ], children: [(0, jsx_runtime_1.jsx)(react_native_1.TextInput, { style: [
                                            styles.textInput,
                                            {
                                                color: colors.text,
                                                fontSize: typography.bodyFontSize,
                                                fontFamily: typography.fontFamily,
                                            },
                                        ], value: inputText, onChangeText: setInputText, placeholder: placeholder, placeholderTextColor: colors.textMuted, multiline: true, maxLength: 4000, editable: !isStreaming }), isStreaming ? ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: abortStream, style: [
                                            styles.sendButton,
                                            {
                                                backgroundColor: colors.errorBackground,
                                                borderRadius: borderRadius.full,
                                            },
                                        ], accessibilityLabel: "Stop generating", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.stopIcon, { color: colors.errorText }], children: "\u25A0" }) })) : ((0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => executeSend(inputText), disabled: !inputText.trim(), style: [
                                            styles.sendButton,
                                            {
                                                backgroundColor: inputText.trim()
                                                    ? colors.sendButtonBackground
                                                    : colors.sendButtonBackground + '44',
                                                borderRadius: borderRadius.full,
                                            },
                                        ], accessibilityLabel: "Send message", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                                styles.sendIcon,
                                                { color: colors.sendButtonIcon },
                                            ], children: "\u2191" }) }))] }), disclaimer ? ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                    styles.disclaimerText,
                                    {
                                        color: colors.textMuted,
                                        fontSize: typography.smallFontSize,
                                        fontFamily: typography.fontFamily,
                                    },
                                ], children: disclaimer })) : null] })] }), isSidebarOpen && ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.backdrop, onPress: () => setIsSidebarOpen(false) })), isSidebarOpen && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                    styles.sidebar,
                    {
                        backgroundColor: colors.surface,
                        borderRightColor: colors.border,
                    },
                ], children: (0, jsx_runtime_1.jsxs)(react_native_1.SafeAreaView, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
                                styles.sidebarHeader,
                                { borderBottomColor: colors.border },
                            ], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                        styles.sidebarTitle,
                                        {
                                            color: colors.text,
                                            fontFamily: typography.fontFamily,
                                        },
                                    ], children: "Chats" }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => setIsSidebarOpen(false), style: styles.sidebarClose, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                            styles.sidebarCloseText,
                                            { color: colors.textSecondary },
                                        ], children: "\u2715" }) })] }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { style: [
                                styles.newChatButton,
                                {
                                    borderColor: colors.primary,
                                    borderRadius: borderRadius.md,
                                },
                            ], onPress: () => {
                                setActiveId(null);
                                setIsSidebarOpen(false);
                            }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                    styles.newChatButtonText,
                                    { color: colors.primary },
                                ], children: "\uFF0B  New Chat" }) }), (0, jsx_runtime_1.jsx)(react_native_1.FlatList, { data: conversations, keyExtractor: (item) => item.id, contentContainerStyle: { paddingBottom: 20 }, renderItem: ({ item }) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
                                    styles.convRow,
                                    activeId === item.id && {
                                        backgroundColor: colors.surfaceSecondary,
                                    },
                                    { borderRadius: borderRadius.sm },
                                ], children: [(0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: styles.convContent, onPress: () => {
                                            setActiveId(item.id);
                                            setIsSidebarOpen(false);
                                        }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                                    styles.convTitle,
                                                    {
                                                        color: activeId === item.id
                                                            ? colors.primary
                                                            : colors.text,
                                                        fontFamily: typography.fontFamily,
                                                    },
                                                ], numberOfLines: 1, children: item.title }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                                    styles.convDate,
                                                    { color: colors.textMuted },
                                                ], children: new Date(item.updatedAt).toLocaleDateString() })] }), (0, jsx_runtime_1.jsx)(react_native_1.TouchableOpacity, { onPress: () => {
                                            react_native_1.Alert.alert('Delete Conversation', 'Are you sure you want to delete this chat?', [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Delete',
                                                    style: 'destructive',
                                                    onPress: () => {
                                                        setConversations((prev) => prev.filter((c) => c.id !== item.id));
                                                        if (activeId === item.id) {
                                                            setActiveId(null);
                                                        }
                                                    },
                                                },
                                            ]);
                                        }, style: styles.deleteButton, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: colors.textMuted }, children: "\uD83D\uDDD1" }) })] })), ListEmptyComponent: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                    styles.emptyConvText,
                                    { color: colors.textMuted },
                                ], children: "No saved chats yet." }) })] }) })), (0, jsx_runtime_1.jsx)(react_native_1.Modal, { visible: isModelPickerOpen, transparent: true, animationType: "fade", onRequestClose: () => setIsModelPickerOpen(false), children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.pickerBackdrop, onPress: () => setIsModelPickerOpen(false), children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
                            styles.pickerSheet,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                            },
                        ], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                    styles.pickerTitle,
                                    { color: colors.textSecondary },
                                ], children: "Select AI Model" }), models.map((m) => ((0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { style: [
                                    styles.pickerItem,
                                    model === m.id && {
                                        backgroundColor: colors.surfaceSecondary,
                                    },
                                    { borderRadius: borderRadius.sm },
                                ], onPress: () => {
                                    setModel(m.id);
                                    setIsModelPickerOpen(false);
                                }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                            styles.pickerItemText,
                                            {
                                                color: model === m.id ? colors.primary : colors.text,
                                                fontWeight: model === m.id ? '700' : '400',
                                            },
                                        ], children: m.label }), model === m.id && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.checkmark, { color: colors.primary }], children: "\u2713" }))] }, m.id)))] }) }) })] }));
});
exports.VibeChatView.displayName = 'VibeChatView';
// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------
const { width: SCREEN_WIDTH } = react_native_1.Dimensions.get('window');
const styles = react_native_1.StyleSheet.create({
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
        paddingBottom: react_native_1.Platform.OS === 'ios' ? 10 : 12,
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
        paddingVertical: react_native_1.Platform.OS === 'ios' ? 6 : 2,
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
        ...react_native_1.StyleSheet.absoluteFillObject,
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
//# sourceMappingURL=VibeChatView.js.map