"use strict";
/**
 * @noblesse/vibe-chat-native
 * Enterprise-ready AI Chat Widget and Screen View SDK for React Native (iOS & Android).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.VibeChatWidget = exports.VibeChatNativeWidget = exports.VibeChatView = void 0;
__exportStar(require("./types"), exports);
__exportStar(require("./theme"), exports);
__exportStar(require("./storage"), exports);
__exportStar(require("./transport"), exports);
__exportStar(require("./clipboard"), exports);
var VibeChatView_1 = require("./VibeChatView");
Object.defineProperty(exports, "VibeChatView", { enumerable: true, get: function () { return VibeChatView_1.VibeChatView; } });
var VibeChatNativeWidget_1 = require("./VibeChatNativeWidget");
Object.defineProperty(exports, "VibeChatNativeWidget", { enumerable: true, get: function () { return VibeChatNativeWidget_1.VibeChatNativeWidget; } });
Object.defineProperty(exports, "VibeChatWidget", { enumerable: true, get: function () { return VibeChatNativeWidget_1.VibeChatWidget; } });
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(VibeChatNativeWidget_1).default; } });
//# sourceMappingURL=index.js.map