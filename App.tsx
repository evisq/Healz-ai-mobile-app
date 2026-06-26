import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { ShareIntentProvider } from 'expo-share-intent';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash } from './src/components/AnimatedSplash';
import { ShareFlow } from './src/sharing/ShareFlow';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppContent() {
  const isDark = useColorScheme() === 'dark';
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [isWebContentReady, setIsWebContentReady] = useState(false);
  const hideSplash = useCallback(() => setIsSplashVisible(false), []);

  return (
    <SafeAreaProvider>
      <View
        style={[
          styles.container,
          { backgroundColor: isDark ? '#181416' : '#FFFFFF' },
        ]}
      >
        <ShareFlow onInitialContentReady={setIsWebContentReady} />
        {isSplashVisible ? (
          <AnimatedSplash
            isWebContentReady={isWebContentReady}
            onFinished={hideSplash}
          />
        ) : null}
        <StatusBar
          animated
          hidden={isSplashVisible}
          style={isDark ? 'light' : 'dark'}
        />
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ShareIntentProvider
      options={{ resetOnBackground: false, scheme: 'healz-mobile' }}
    >
      <AppContent />
    </ShareIntentProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
