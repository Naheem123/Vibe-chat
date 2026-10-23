import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * @noblesse/vibe-chat-native
 * VibeChatNativeWidget — Floating action button + full-screen modal chat widget.
 * Drop-in component for React Native applications (iOS & Android).
 */
import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback, } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Animated, Easing, Platform, useColorScheme, } from 'react-native';
import { resolveTheme } from './theme';
import { VibeChatView } from './VibeChatView';
function FABPulse({ backgroundColor, ringColor, onPress, position, customIcon, }) {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const animation = Animated.loop(Animated.sequence([
            Animated.timing(pulse, {
                toValue: 1.14,
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
    return (_jsxs(TouchableOpacity, { activeOpacity: 0.88, onPress: onPress, style: [styles.fab, fabPositionStyle, { backgroundColor }], accessibilityLabel: "Open AI Chat Widget", accessibilityRole: "button", children: [_jsx(Animated.View, { style: [
                    styles.fabRing,
                    {
                        borderColor: ringColor,
                        transform: [{ scale: pulse }],
                    },
                ] }), customIcon ? (customIcon) : (_jsxs(View, { style: styles.fabIconContainer, children: [_jsx(View, { style: styles.fabBubble }), _jsx(View, { style: styles.fabTail })] }))] }));
}
// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const VibeChatNativeWidget = forwardRef((props, ref) => {
    const { initialOpen = false, fabPosition, fabIcon, theme: userTheme, onOpen, onClose, ...viewProps } = props;
    const [isOpen, setIsOpen] = useState(initialOpen);
    const viewRef = useRef(null);
    // Theme resolution
    const systemScheme = useColorScheme() || 'light';
    const resolvedTheme = useMemo(() => resolveTheme(userTheme, systemScheme), [userTheme, systemScheme]);
    const { colors } = resolvedTheme;
    const handleOpen = useCallback(() => {
        setIsOpen(true);
        onOpen?.();
    }, [onOpen]);
    const handleClose = useCallback(() => {
        setIsOpen(false);
        onClose?.();
    }, [onClose]);
    // Imperative handle forwarding
    useImperativeHandle(ref, () => ({
        open: handleOpen,
        close: handleClose,
        isOpen: () => isOpen,
        sendMessage: (text) => viewRef.current ? viewRef.current.sendMessage(text) : Promise.resolve(),
        abort: () => viewRef.current?.abort(),
        clearHistory: () => viewRef.current ? viewRef.current.clearHistory() : Promise.resolve(),
        newChat: () => viewRef.current?.newChat(),
    }), [handleOpen, handleClose, isOpen]);
    return (_jsxs(_Fragment, { children: [_jsx(Modal, { visible: isOpen, animationType: "slide", transparent: false, onRequestClose: handleClose, statusBarTranslucent: Platform.OS === 'android', children: _jsx(VibeChatView, { ref: viewRef, theme: userTheme, onClose: handleClose, ...viewProps }) }), !isOpen && (_jsx(FABPulse, { backgroundColor: colors.fabBackground || colors.primary, ringColor: colors.fabRingColor || colors.secondary || colors.primary, onPress: handleOpen, position: fabPosition, customIcon: fabIcon }))] }));
});
VibeChatNativeWidget.displayName = 'VibeChatNativeWidget';
// Convenience alias requested in user prompt: <VibeChatWidget ... />
export const VibeChatWidget = VibeChatNativeWidget;
// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
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
export default VibeChatNativeWidget;
//# sourceMappingURL=VibeChatNativeWidget.js.map