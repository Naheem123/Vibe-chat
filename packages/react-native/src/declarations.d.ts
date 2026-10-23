/**
 * Ambient type declarations for React Native primitives.
 * Enables zero-dependency standalone compilation of the SDK.
 */

declare module 'react-native' {
  import * as React from 'react';

  export type StyleProp<T> = T | Array<T> | undefined | null | false;

  export interface ViewStyle {
    flex?: number;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    justifyContent?:
      | 'flex-start'
      | 'flex-end'
      | 'center'
      | 'space-between'
      | 'space-around'
      | 'space-evenly';
    alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    position?: 'absolute' | 'relative';
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    width?: number | string;
    height?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;
    minWidth?: number | string;
    minHeight?: number | string;
    margin?: number;
    marginHorizontal?: number;
    marginVertical?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    padding?: number;
    paddingHorizontal?: number;
    paddingVertical?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderTopWidth?: number;
    borderBottomWidth?: number;
    borderLeftWidth?: number;
    borderRightWidth?: number;
    borderRadius?: number;
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    borderBottomLeftRadius?: number;
    borderBottomRightRadius?: number;
    opacity?: number;
    zIndex?: number;
    elevation?: number;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    overflow?: 'visible' | 'hidden' | 'scroll';
    gap?: number;
    transform?: any[];
  }

  export interface TextStyle extends ViewStyle {
    color?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontFamily?: string;
    fontStyle?: 'normal' | 'italic';
    textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
    lineHeight?: number;
    letterSpacing?: number;
    textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through';
    textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  }

  export const View: React.ComponentType<any>;
  export const Text: React.ComponentType<any>;
  export const TouchableOpacity: React.ComponentType<any>;
  export const Modal: React.ComponentType<any>;
  export const TextInput: React.ComponentType<any>;
  export class FlatList<ItemT = any> extends React.Component<any> {
    scrollToEnd(params?: { animated?: boolean }): void;
    scrollToIndex(params: any): void;
    scrollToItem(params: any): void;
    scrollToOffset(params: { offset: number; animated?: boolean }): void;
  }
  export const SafeAreaView: React.ComponentType<any>;
  export const KeyboardAvoidingView: React.ComponentType<any>;
  export const ActivityIndicator: React.ComponentType<any>;
  export const Pressable: React.ComponentType<any>;
  export const StatusBar: React.ComponentType<any> & {
    currentHeight?: number;
  };

  export const Platform: {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    select: <T>(specifics: { ios?: T; android?: T; default?: T }) => T;
  };

  export const Dimensions: {
    get: (dim: 'window' | 'screen') => { width: number; height: number; scale: number; fontScale: number };
  };

  export const StyleSheet: {
    create: <T extends Record<string, ViewStyle | TextStyle>>(styles: T) => T;
    absoluteFillObject: ViewStyle;
  };

  export const Alert: {
    alert: (title: string, message?: string, buttons?: any[], options?: any) => void;
  };

  export namespace Animated {
    export class Value {
      constructor(val: number);
      setValue(val: number): void;
      interpolate(config: any): any;
    }
    export const timing: (value: Value, config: any) => { start: (cb?: () => void) => void; stop: () => void };
    export const sequence: (animations: any[]) => { start: (cb?: () => void) => void; stop: () => void };
    export const loop: (animation: any) => { start: (cb?: () => void) => void; stop: () => void };
    export const delay: (time: number) => any;
    export const View: React.ComponentType<any>;
  }

  export const Easing: {
    ease: any;
    linear: any;
    in: (easing: any) => any;
    out: (easing: any) => any;
    inOut: (easing: any) => any;
    cubic: any;
  };

  export const useColorScheme: () => 'light' | 'dark' | null | undefined;

  export const Clipboard: {
    setString: (content: string) => void;
    getString: () => Promise<string>;
  };
}

declare module '@react-native-clipboard/clipboard' {
  const Clipboard: {
    setString: (content: string) => void;
    getString: () => Promise<string>;
  };
  export default Clipboard;
}
