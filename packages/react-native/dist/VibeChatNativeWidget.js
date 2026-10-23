"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VibeChatWidget = exports.VibeChatNativeWidget = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * @noblesse/vibe-chat-native
 * VibeChatNativeWidget — Floating action button + full-screen modal chat widget.
 * Drop-in component for React Native applications (iOS & Android).
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const theme_1 = require("./theme");
const VibeChatView_1 = require("./VibeChatView");
function FABPulse({ backgroundColor, ringColor, onPress, position, customIcon, }) {
    const pulse = (0, react_1.useRef)(new react_native_1.Animated.Value(1)).current;
    (0, react_1.useEffect)(() => {
        const animation = react_native_1.Animated.loop(react_native_1.Animated.sequence([
            react_native_1.Animated.timing(pulse, {
                toValue: 1.14,
                duration: 950,
                easing: react_native_1.Easing.inOut(react_native_1.Easing.ease),
                useNativeDriver: true,
            }),
            react_native_1.Animated.timing(pulse, {
                toValue: 1,
                duration: 950,
                easing: react_native_1.Easing.inOut(react_native_1.Easing.ease),
                useNativeDriver: true,
            }),
        ]));
        animation.start();
        return () => animation.stop();
    }, [pulse]);
    const fabPositionStyle = {
        bottom: position?.bottom ?? 24,
        right: position?.right ?? 24,
        left: position?.left,
        top: position?.top,
    };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.TouchableOpacity, { activeOpacity: 0.88, onPress: onPress, style: [styles.fab, fabPositionStyle, { backgroundColor }], accessibilityLabel: "Open AI Chat Widget", accessibilityRole: "button", children: [(0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [
                    styles.fabRing,
                    {
                        borderColor: ringColor,
                        transform: [{ scale: pulse }],
                    },
                ] }), customIcon ? (customIcon) : ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.fabIconContainer, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.fabBubble }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.fabTail })] }))] }));
}
// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
exports.VibeChatNativeWidget = (0, react_1.forwardRef)((props, ref) => {
    const { initialOpen = false, fabPosition, fabIcon, theme: userTheme, onOpen, onClose, ...viewProps } = props;
    const [isOpen, setIsOpen] = (0, react_1.useState)(initialOpen);
    const viewRef = (0, react_1.useRef)(null);
    // Theme resolution
    const systemScheme = (0, react_native_1.useColorScheme)() || 'light';
    const resolvedTheme = (0, react_1.useMemo)(() => (0, theme_1.resolveTheme)(userTheme, systemScheme), [userTheme, systemScheme]);
    const { colors } = resolvedTheme;
    const handleOpen = (0, react_1.useCallback)(() => {
        setIsOpen(true);
        onOpen?.();
    }, [onOpen]);
    const handleClose = (0, react_1.useCallback)(() => {
        setIsOpen(false);
        onClose?.();
    }, [onClose]);
    // Imperative handle forwarding
    (0, react_1.useImperativeHandle)(ref, () => ({
        open: handleOpen,
        close: handleClose,
        isOpen: () => isOpen,
        sendMessage: (text) => viewRef.current ? viewRef.current.sendMessage(text) : Promise.resolve(),
        abort: () => viewRef.current?.abort(),
        clearHistory: () => viewRef.current ? viewRef.current.clearHistory() : Promise.resolve(),
        newChat: () => viewRef.current?.newChat(),
    }), [handleOpen, handleClose, isOpen]);
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Modal, { visible: isOpen, animationType: "slide", transparent: false, onRequestClose: handleClose, statusBarTranslucent: react_native_1.Platform.OS === 'android', children: (0, jsx_runtime_1.jsx)(VibeChatView_1.VibeChatView, { ref: viewRef, theme: userTheme, onClose: handleClose, ...viewProps }) }), !isOpen && ((0, jsx_runtime_1.jsx)(FABPulse, { backgroundColor: colors.fabBackground || colors.primary, ringColor: colors.fabRingColor || colors.secondary || colors.primary, onPress: handleOpen, position: fabPosition, customIcon: fabIcon }))] }));
});
exports.VibeChatNativeWidget.displayName = 'VibeChatNativeWidget';
// Convenience alias requested in user prompt: <VibeChatWidget ... />
exports.VibeChatWidget = exports.VibeChatNativeWidget;
// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------
const styles = react_native_1.StyleSheet.create({
    fab: {
        position: 'absolute',
        zIndex: 9999,
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
    },
    fabRing: {
        position: 'absolute',
        width: 74,
        height: 74,
        borderRadius: 37,
        borderWidth: 2,
        opacity: 0.35,
    },
    fabIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fabBubble: {
        width: 26,
        height: 20,
        borderRadius: 10,
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
    },
    fabTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 0,
        borderTopWidth: 7,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#FFFFFF',
        marginTop: -2,
        marginLeft: 8,
        alignSelf: 'flex-end',
    },
});
exports.default = exports.VibeChatNativeWidget;
//# sourceMappingURL=VibeChatNativeWidget.js.map