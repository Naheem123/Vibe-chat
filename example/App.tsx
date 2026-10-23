/**
 * Noblesse Tribe — React Native Example Application
 * Demonstrating @noblesse/vibe-chat-native integration.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';

import {
  VibeChatNativeWidget,
  VibeChatView,
  noblesseTribeTheme,
  NOBLESSE_BRAND,
  VibeChatRef,
} from '../packages/react-native/src';

// Host app brand palette
const brand = {
  blueDark: '#201E5A',
  blueLight: '#0AB1DE',
  green: '#01C542',
  white: '#FFFFFF',
  black: '#000000',
};

// Test OpenRouter Key (for development/validation demo)
// In production, route via Noblesse Tribe's Go backend proxy or load from secure storage.
const TEST_API_KEY =
  process.env.OPENROUTER_API_KEY || 'sk-or-v1-your-openrouter-key-here';

type ViewMode = 'floating' | 'embedded';

export default function App() {
  const [mode, setMode] = useState<ViewMode>('floating');
  const [currentUser, setCurrentUser] = useState<'alex' | 'lardey'>('lardey');
  const widgetRef = useRef<VibeChatRef>(null);

  const userId = `noblesse_user_${currentUser}`;
  const userName = currentUser === 'lardey' ? 'Lardey (Member)' : 'Alex (Admin)';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={brand.blueDark} />

      {/* App Header */}
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.appTitle}>Noblesse Tribe</Text>
          <Text style={styles.appSubtitle}>Active Account: {userName}</Text>
        </View>
        <TouchableOpacity
          style={styles.switchUserButton}
          onPress={() => {
            const next = currentUser === 'lardey' ? 'alex' : 'lardey';
            setCurrentUser(next);
            Alert.alert(
              'Account Switched',
              `Switched to ${next === 'lardey' ? 'Lardey' : 'Alex'}. History is fully isolated per account.`
            );
          }}
        >
          <Text style={styles.switchUserText}>Switch User</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Selector */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.tab, mode === 'floating' && styles.tabActive]}
          onPress={() => setMode('floating')}
        >
          <Text
            style={[styles.tabText, mode === 'floating' && styles.tabTextActive]}
          >
            Floating Widget Mode
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'embedded' && styles.tabActive]}
          onPress={() => setMode('embedded')}
        >
          <Text
            style={[styles.tabText, mode === 'embedded' && styles.tabTextActive]}
          >
            Embedded Screen Mode
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'floating' ? (
        /* ── Floating Widget Mode View ───────────────────────────────── */
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Host App Dashboard</Text>
            <Text style={styles.cardBody}>
              The AI Chat widget is running in floating action button (FAB) mode.
              Tap the circular button at the bottom-right of the screen to open
              the Noblesse AI Assistant modal.
            </Text>

            <View style={styles.brandRow}>
              <View
                style={[styles.colorChip, { backgroundColor: brand.blueDark }]}
              >
                <Text style={styles.chipLabel}>BlueDark</Text>
              </View>
              <View
                style={[styles.colorChip, { backgroundColor: brand.blueLight }]}
              >
                <Text style={styles.chipLabel}>BlueLight</Text>
              </View>
              <View
                style={[styles.colorChip, { backgroundColor: brand.green }]}
              >
                <Text style={styles.chipLabel}>Green</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Isolation & Security</Text>
            <Text style={styles.cardBody}>
              Conversations are strictly scoped to <Text style={styles.bold}>{userId}</Text>.
              Switching accounts instantly isolates and switches history without data leakage.
            </Text>
            <TouchableOpacity
              style={styles.clearHistoryButton}
              onPress={async () => {
                await widgetRef.current?.clearHistory();
                Alert.alert(
                  'History Purged',
                  `Cleared local history for ${userName} upon simulated logout.`
                );
              }}
            >
              <Text style={styles.clearHistoryText}>
                Simulate Logout & Clear History
              </Text>
            </TouchableOpacity>
          </View>

          {/* Floating Action Button Widget */}
          <VibeChatNativeWidget
            ref={widgetRef}
            assistantName="Noblesse AI"
            openRouterKey={TEST_API_KEY}
            userId={userId}
            theme={{
              primary: brand.blueDark,
              secondary: brand.blueLight,
              accent: brand.green,
              background: brand.white,
              text: brand.black,
            }}
            suggestions={[
              '✨ What is Noblesse Tribe and how does it work?',
              '🧑‍💻 Help me integrate the React Native SDK',
              '🌍 How do we secure API keys in mobile apps?',
            ]}
          />
        </ScrollView>
      ) : (
        /* ── Embedded Screen Mode View ───────────────────────────────── */
        <View style={styles.embeddedContainer}>
          <VibeChatView
            assistantName="Noblesse AI"
            openRouterKey={TEST_API_KEY}
            userId={userId}
            theme={{
              primary: brand.blueDark,
              secondary: brand.blueLight,
              accent: brand.green,
              background: brand.white,
              text: brand.black,
            }}
            showHeader={false}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#201E5A',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#0AB1DE',
    marginTop: 2,
    fontWeight: '600',
  },
  switchUserButton: {
    backgroundColor: '#0AB1DE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchUserText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 12,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#161626',
    borderBottomWidth: 1,
    borderBottomColor: '#28283C',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#01C542',
  },
  tabText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#18182A',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#26263E',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: '#0AB1DE',
  },
  brandRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  colorChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearHistoryButton: {
    marginTop: 14,
    backgroundColor: '#3B1A24',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F87171',
  },
  clearHistoryText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '700',
  },
  embeddedContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
