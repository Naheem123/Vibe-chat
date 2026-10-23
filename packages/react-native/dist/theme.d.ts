/**
 * @noblesse/vibe-chat-native
 * Robust, accessible theming system supporting Noblesse Tribe brand palette
 * and custom host application styling.
 */
import { VibeChatTheme, VibeChatColors } from './types';
export declare const defaultDarkColors: VibeChatColors;
export declare const defaultLightColors: VibeChatColors;
export declare const noblesseTribeLightColors: VibeChatColors;
export declare const noblesseTribeDarkColors: VibeChatColors;
export declare const noblesseTribeTheme: VibeChatTheme;
export interface ResolvedTheme {
    colors: VibeChatColors;
    typography: {
        fontFamily?: string;
        headerFontSize: number;
        bodyFontSize: number;
        smallFontSize: number;
        lineHeight: number;
    };
    borderRadius: Required<NonNullable<VibeChatTheme['borderRadius']>>;
    customStyles: NonNullable<VibeChatTheme['customStyles']>;
    isDark: boolean;
}
export declare function resolveTheme(inputTheme?: VibeChatTheme | Partial<VibeChatColors>, systemColorScheme?: 'light' | 'dark'): ResolvedTheme;
export declare function createTheme(overrides: Partial<VibeChatTheme>): VibeChatTheme;
//# sourceMappingURL=theme.d.ts.map