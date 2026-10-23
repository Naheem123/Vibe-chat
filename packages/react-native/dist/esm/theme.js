/**
 * @noblesse/vibe-chat-native
 * Robust, accessible theming system supporting Noblesse Tribe brand palette
 * and custom host application styling.
 */
import { NOBLESSE_BRAND, } from './types';
// ---------------------------------------------------------------------------
// Sensible Defaults
// ---------------------------------------------------------------------------
export const defaultDarkColors = {
    primary: '#6366F1',
    secondary: '#818CF8',
    accent: '#10B981',
    background: '#0F0F14',
    surface: '#1A1A28',
    surfaceSecondary: '#242438',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#272738',
    userBubbleBackground: '#6366F1',
    userBubbleText: '#FFFFFF',
    assistantBubbleBackground: '#1E1E2E',
    assistantBubbleText: '#E2E8F0',
    errorBackground: '#3B0C0C',
    errorText: '#FCA5A5',
    sendButtonBackground: '#6366F1',
    sendButtonIcon: '#FFFFFF',
    fabBackground: '#6366F1',
    fabRingColor: '#6366F1',
};
export const defaultLightColors = {
    primary: '#4F46E5',
    secondary: '#6366F1',
    accent: '#059669',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceSecondary: '#EDF2F7',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    userBubbleBackground: '#4F46E5',
    userBubbleText: '#FFFFFF',
    assistantBubbleBackground: '#F1F5F9',
    assistantBubbleText: '#1E293B',
    errorBackground: '#FEE2E2',
    errorText: '#991B1B',
    sendButtonBackground: '#4F46E5',
    sendButtonIcon: '#FFFFFF',
    fabBackground: '#4F46E5',
    fabRingColor: '#4F46E5',
};
// ---------------------------------------------------------------------------
// Noblesse Tribe Brand Themes
// ---------------------------------------------------------------------------
export const noblesseTribeLightColors = {
    primary: NOBLESSE_BRAND.blueDark, // #201E5A
    secondary: NOBLESSE_BRAND.blueLight, // #0AB1DE
    accent: NOBLESSE_BRAND.green, // #01C542
    background: NOBLESSE_BRAND.white, // #FFFFFF
    surface: '#F8FAFC',
    surfaceSecondary: '#E2E8F0',
    text: NOBLESSE_BRAND.black, // #000000
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    userBubbleBackground: NOBLESSE_BRAND.blueDark, // #201E5A
    userBubbleText: NOBLESSE_BRAND.white, // #FFFFFF
    assistantBubbleBackground: '#F1F5F9',
    assistantBubbleText: NOBLESSE_BRAND.black, // #000000
    errorBackground: '#FEE2E2',
    errorText: '#991B1B',
    sendButtonBackground: NOBLESSE_BRAND.blueDark,
    sendButtonIcon: NOBLESSE_BRAND.white,
    fabBackground: NOBLESSE_BRAND.blueDark,
    fabRingColor: NOBLESSE_BRAND.blueLight,
};
export const noblesseTribeDarkColors = {
    primary: NOBLESSE_BRAND.blueLight, // #0AB1DE
    secondary: NOBLESSE_BRAND.blueDark, // #201E5A
    accent: NOBLESSE_BRAND.green, // #01C542
    background: '#0B0B16',
    surface: '#151526',
    surfaceSecondary: '#1F1F38',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#24243C',
    userBubbleBackground: NOBLESSE_BRAND.blueLight, // #0AB1DE
    userBubbleText: NOBLESSE_BRAND.black, // #000000
    assistantBubbleBackground: '#17172B',
    assistantBubbleText: '#F1F5F9',
    errorBackground: '#3D0D0D',
    errorText: '#FCA5A5',
    sendButtonBackground: NOBLESSE_BRAND.blueLight,
    sendButtonIcon: NOBLESSE_BRAND.black,
    fabBackground: NOBLESSE_BRAND.blueLight,
    fabRingColor: NOBLESSE_BRAND.green,
};
export const noblesseTribeTheme = {
    mode: 'auto',
    colors: noblesseTribeLightColors,
    borderRadius: {
        sm: 8,
        md: 14,
        lg: 20,
        bubble: 18,
        full: 9999,
    },
};
export function resolveTheme(inputTheme, systemColorScheme = 'dark') {
    const isFullTheme = inputTheme && 'colors' in inputTheme;
    const themeObj = isFullTheme
        ? inputTheme
        : { colors: inputTheme || {} };
    const mode = themeObj.mode || 'auto';
    const isDark = mode === 'dark' || (mode === 'auto' && systemColorScheme === 'dark');
    const baseColors = isDark ? defaultDarkColors : defaultLightColors;
    const userColors = themeObj.colors || {};
    const primary = userColors.primary || baseColors.primary;
    const secondary = userColors.secondary || baseColors.secondary;
    const accent = userColors.accent || baseColors.accent;
    const background = userColors.background || baseColors.background;
    const text = userColors.text || baseColors.text;
    const resolvedColors = {
        primary,
        secondary,
        accent,
        background,
        surface: userColors.surface || (isDark ? '#1A1A28' : '#F8FAFC'),
        surfaceSecondary: userColors.surfaceSecondary || (isDark ? '#242438' : '#EDF2F7'),
        text,
        textSecondary: userColors.textSecondary || (isDark ? '#94A3B8' : '#475569'),
        textMuted: userColors.textMuted || (isDark ? '#64748B' : '#94A3B8'),
        border: userColors.border || (isDark ? '#272738' : '#E2E8F0'),
        userBubbleBackground: userColors.userBubbleBackground || primary,
        userBubbleText: userColors.userBubbleText || (isDark ? '#FFFFFF' : '#FFFFFF'),
        assistantBubbleBackground: userColors.assistantBubbleBackground ||
            (isDark ? '#1E1E2E' : '#F1F5F9'),
        assistantBubbleText: userColors.assistantBubbleText || (isDark ? '#E2E8F0' : '#1E293B'),
        errorBackground: userColors.errorBackground || (isDark ? '#3B0C0C' : '#FEE2E2'),
        errorText: userColors.errorText || (isDark ? '#FCA5A5' : '#991B1B'),
        sendButtonBackground: userColors.sendButtonBackground || primary,
        sendButtonIcon: userColors.sendButtonIcon || '#FFFFFF',
        fabBackground: userColors.fabBackground || primary,
        fabRingColor: userColors.fabRingColor || secondary || primary,
    };
    const resolvedTypography = {
        fontFamily: themeObj.typography?.fontFamily || undefined,
        headerFontSize: themeObj.typography?.headerFontSize || 18,
        bodyFontSize: themeObj.typography?.bodyFontSize || 15,
        smallFontSize: themeObj.typography?.smallFontSize || 12,
        lineHeight: themeObj.typography?.lineHeight || 22,
    };
    const resolvedBorderRadius = {
        sm: themeObj.borderRadius?.sm ?? 8,
        md: themeObj.borderRadius?.md ?? 14,
        lg: themeObj.borderRadius?.lg ?? 20,
        bubble: themeObj.borderRadius?.bubble ?? 18,
        full: themeObj.borderRadius?.full ?? 9999,
    };
    return {
        colors: resolvedColors,
        typography: resolvedTypography,
        borderRadius: resolvedBorderRadius,
        customStyles: themeObj.customStyles || {},
        isDark,
    };
}
export function createTheme(overrides) {
    return {
        ...overrides,
        colors: overrides.colors || {},
    };
}
//# sourceMappingURL=theme.js.map