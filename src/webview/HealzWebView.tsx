import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import {
  createAttachmentChunkScript,
  createAttachmentFinalizeScript,
  createAttachmentInitScript,
  iterateBase64Chunks,
} from '../sharing/attachmentBridge';
import type {
  AttachmentBridgeResult,
  AttachmentPayload,
} from '../sharing/types';
import { classifyUrl, HEALZ_CHAT_URL, HEALZ_URL } from './urlPolicy';

type HealzWebViewProps = {
  isOffline: boolean;
  onAttachmentResult: (result: AttachmentBridgeResult) => void;
  onInitialContentReady: (isReady: boolean) => void;
  onLocationChange: (url: string) => void;
};

export type HealzWebViewHandle = {
  attachSharedFiles: (files: AttachmentPayload[]) => Promise<void>;
  openChat: () => void;
};

type LoadError = {
  description: string;
};

const wait = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

export const HealzWebView = forwardRef<
  HealzWebViewHandle,
  HealzWebViewProps
>(function HealzWebView(
  {
    isOffline,
    onAttachmentResult,
    onInitialContentReady,
    onLocationChange,
  },
  forwardedRef,
) {
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isFirstLoadFinished, setIsFirstLoadFinished] = useState(false);

  useImperativeHandle(
    forwardedRef,
    () => ({
      openChat() {
        webViewRef.current?.injectJavaScript(
          `window.location.href = ${JSON.stringify(HEALZ_CHAT_URL)}; true;`,
        );
      },
      async attachSharedFiles(files) {
        const metadata = files.map(({ base64: _base64, ...file }) => file);
        webViewRef.current?.injectJavaScript(
          createAttachmentInitScript(metadata),
        );
        await wait(25);

        for (const [fileIndex, file] of files.entries()) {
          for (const chunk of iterateBase64Chunks(file.base64)) {
            webViewRef.current?.injectJavaScript(
              createAttachmentChunkScript(fileIndex, chunk),
            );
            await wait(8);
          }
        }

        webViewRef.current?.injectJavaScript(
          createAttachmentFinalizeScript(),
        );
      },
    }),
    [],
  );

  const markInitialContentReady = useCallback(() => {
    setIsFirstLoadFinished(true);
    onInitialContentReady(true);
  }, [onInitialContentReady]);

  const openExternalUrl = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);

      if (!canOpen) {
        throw new Error('No application can open this URL');
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Не удалось открыть ссылку',
        'На устройстве нет подходящего приложения или ссылка недоступна.',
      );
    }
  }, []);

  const handleUrl = useCallback(
    (url: string) => {
      const disposition = classifyUrl(url);

      if (disposition === 'internal') {
        return true;
      }

      if (disposition === 'external') {
        void openExternalUrl(url);
      }

      return false;
    },
    [openExternalUrl],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!canGoBackRef.current) {
          return false;
        }

        webViewRef.current?.goBack();
        return true;
      },
    );

    return () => subscription.remove();
  }, []);

  const retry = () => {
    setLoadError(null);
    setLoadProgress(0);
    webViewRef.current?.reload();
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const result = JSON.parse(
        event.nativeEvent.data,
      ) as AttachmentBridgeResult;

      if (result.source === 'healz-mobile-share') {
        onAttachmentResult(result);
      }
    } catch {
      // Ignore messages that do not belong to the mobile attachment bridge.
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          allowsBackForwardNavigationGestures
          allowsFullscreenVideo
          cacheEnabled
          domStorageEnabled
          incognito={false}
          javaScriptCanOpenWindowsAutomatically
          javaScriptEnabled
          mixedContentMode="never"
          onError={(event) => {
            setLoadError({
              description:
                event.nativeEvent.description || 'Не удалось загрузить Healz.',
            });
            markInitialContentReady();
          }}
          onLoadEnd={markInitialContentReady}
          onLoadProgress={(event) => {
            setLoadProgress(event.nativeEvent.progress);
          }}
          onLoadStart={() => {
            setLoadError(null);
            setLoadProgress(0);
          }}
          onNavigationStateChange={(navigationState) => {
            canGoBackRef.current = navigationState.canGoBack;
            onLocationChange(navigationState.url);
          }}
          onMessage={handleMessage}
          onRenderProcessGone={() => {
            setLoadError({
              description: 'Android WebView был остановлен системой.',
            });
            markInitialContentReady();
          }}
          onOpenWindow={(event) => {
            const targetUrl = event.nativeEvent.targetUrl;
            const disposition = classifyUrl(targetUrl);

            if (disposition === 'internal') {
              webViewRef.current?.injectJavaScript(
                `window.location.href = ${JSON.stringify(targetUrl)}; true;`,
              );
              return;
            }

            if (disposition === 'external') {
              void openExternalUrl(targetUrl);
            }
          }}
          onShouldStartLoadWithRequest={(request) => handleUrl(request.url)}
          originWhitelist={[
            'about:*',
            'blob:*',
            'geo:*',
            'http://*',
            'https://*',
            'mailto:*',
            'sms:*',
            'tel:*',
          ]}
          renderError={() => <View style={styles.nativeErrorPlaceholder} />}
          setSupportMultipleWindows
          sharedCookiesEnabled
          source={{ uri: HEALZ_URL }}
          thirdPartyCookiesEnabled
        />

        {!isFirstLoadFinished && !loadError ? (
          <View
            accessibilityLabel="Загружаем Healz"
            accessibilityLiveRegion="polite"
            accessibilityRole="progressbar"
            accessibilityValue={{
              max: 100,
              min: 0,
              now: Math.round(loadProgress * 100),
            }}
            pointerEvents="none"
            style={styles.loadingOverlay}
          >
            <ActivityIndicator
              color={isDark ? '#E4AFC3' : '#A94D6F'}
              size="small"
            />
            <Text style={styles.loadingText}>Загружаем Healz…</Text>
          </View>
        ) : null}

        {loadProgress > 0 && loadProgress < 1 && !loadError ? (
          <View pointerEvents="none" style={styles.progressTrack}>
            <View
              style={[
                styles.progressValue,
                { width: `${Math.max(loadProgress * 100, 8)}%` },
              ]}
            />
          </View>
        ) : null}

        {loadError || isOffline ? (
          <View style={styles.errorOverlay}>
            <Text accessibilityRole="header" style={styles.errorTitle}>
              {isOffline
                ? 'Нет подключения к интернету'
                : 'Healz сейчас недоступен'}
            </Text>
            <Text style={styles.errorMessage}>
              {isOffline
                ? 'Подключитесь к сети — подготовленные документы останутся в приложении.'
                : 'Попробуйте загрузить страницу ещё раз.'}
            </Text>
            <Pressable
              accessibilityLabel="Повторить загрузку Healz"
              accessibilityRole="button"
              disabled={isOffline}
              onPress={retry}
              style={({ pressed }) => [
                styles.retryButton,
                isOffline && styles.retryButtonDisabled,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
});

function createStyles(isDark: boolean) {
  const colors = isDark
    ? {
        accent: '#E4AFC3',
        background: '#181416',
        button: '#E7DDE1',
        buttonText: '#2A2226',
        muted: '#C8BBC2',
        track: '#4C3540',
        text: '#F7EFF3',
      }
    : {
        accent: '#A94D6F',
        background: '#FFFFFF',
        button: '#4B4040',
        buttonText: '#FFFFFF',
        muted: '#655C63',
        track: '#F5E7ED',
        text: '#2D262E',
      };

  return StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: colors.background,
    bottom: 0,
    gap: 12,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  progressTrack: {
    backgroundColor: colors.track,
    height: 2,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  progressValue: {
    backgroundColor: colors.accent,
    height: '100%',
  },
  nativeErrorPlaceholder: {
    backgroundColor: colors.background,
    flex: 1,
  },
  errorOverlay: {
    alignItems: 'center',
    backgroundColor: colors.background,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 34,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.button,
    borderRadius: 12,
    marginTop: 24,
    minWidth: 138,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  retryButtonPressed: {
    opacity: 0.82,
  },
  retryButtonDisabled: {
    opacity: 0.45,
  },
  retryButtonText: {
    color: colors.buttonText,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  });
}
