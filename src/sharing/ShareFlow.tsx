import * as Network from 'expo-network';
import { useShareIntentContext } from 'expo-share-intent';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  type AppStateStatus,
  StyleSheet,
  View,
} from 'react-native';

import {
  PreparationCancelledError,
  prepareSharedFiles,
} from '../preprocessing/prepareSharedFiles';
import {
  type HealzWebViewHandle,
  HealzWebView,
} from '../webview/HealzWebView';
import { HEALZ_URL, isHealzChatUrl } from '../webview/urlPolicy';
import {
  cleanupImportedFiles,
  cleanupSharedCache,
  createAttachmentPayload,
  importSharedFiles,
} from './fileImport';
import {
  ShareImportOverlay,
  type ShareFlowStatus,
} from './ShareImportOverlay';
import type {
  AttachmentBridgeResult,
  ImportedSharedFile,
} from './types';
import {
  ATTACHMENT_RESULT_TIMEOUT_MS,
  BETWEEN_FILE_DELAY_MS,
  getTransferProgress,
  isNetworkUnavailable,
  runSequentialQueue,
} from './transferPolicy';

type ShareFlowProps = {
  onInitialContentReady: (isReady: boolean) => void;
};

class AttachmentTransferError extends Error {
  constructor(readonly result: AttachmentBridgeResult) {
    super(result.message ?? 'Не удалось добавить файл в Healz.');
    this.name = 'AttachmentTransferError';
  }
}

class TransferDeferredError extends Error {
  constructor(readonly nextStatus: 'offline' | 'waiting') {
    super(nextStatus);
    this.name = 'TransferDeferredError';
  }
}

const wait = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

export function ShareFlow({ onInitialContentReady }: ShareFlowProps) {
  const {
    error: shareIntentError,
    hasShareIntent,
    resetShareIntent,
    shareIntent,
  } = useShareIntentContext();
  const webViewRef = useRef<HealzWebViewHandle>(null);
  const importedFilesRef = useRef<ImportedSharedFile[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const bridgeResultResolverRef = useRef<
    ((result: AttachmentBridgeResult) => void) | null
  >(null);
  const bridgeResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isHandlingIntentRef = useRef(false);
  const isTransferringRef = useRef(false);
  const nextTransferIndexRef = useRef(0);
  const operationIdRef = useRef(0);
  const startupCleanupPromiseRef = useRef<Promise<void> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!startupCleanupPromiseRef.current) {
    startupCleanupPromiseRef.current = cleanupSharedCache();
  }

  const networkState = Network.useNetworkState();
  const isOffline = isNetworkUnavailable(networkState);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const [currentUrl, setCurrentUrl] = useState(HEALZ_URL);
  const [files, setFiles] = useState<ImportedSharedFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [preparationProgress, setPreparationProgress] = useState<{
    current: number;
    fileName: string;
    total: number;
  } | null>(null);
  const [transferProgress, setTransferProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [status, setStatus] = useState<ShareFlowStatus>('idle');

  const replaceFiles = useCallback((nextFiles: ImportedSharedFile[]) => {
    importedFilesRef.current = nextFiles;
    setFiles(nextFiles);
  }, []);

  const resetFlow = useCallback(async () => {
    operationIdRef.current += 1;

    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }

    const filesToDelete = importedFilesRef.current;
    importedFilesRef.current = [];
    setFiles([]);
    setMessage(null);
    setPreparationProgress(null);
    setTransferProgress(null);
    setStatus('idle');
    nextTransferIndexRef.current = 0;
    isTransferringRef.current = false;
    await cleanupImportedFiles(filesToDelete);
  }, []);

  useEffect(
    () => () => {
      operationIdRef.current += 1;

      if (bridgeResultTimerRef.current) {
        clearTimeout(bridgeResultTimerRef.current);
      }
      bridgeResultResolverRef.current = null;

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      void cleanupImportedFiles(importedFilesRef.current);
    },
    [],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      setAppState(nextState);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isOffline && status === 'waiting') {
      setStatus('offline');
    }
  }, [isOffline, status]);

  useEffect(() => {
    if (!shareIntentError) {
      return;
    }

    setMessage(shareIntentError);
    setStatus('error');
    resetShareIntent(true);
  }, [resetShareIntent, shareIntentError]);

  useEffect(() => {
    if (!hasShareIntent) {
      isHandlingIntentRef.current = false;
    }
  }, [hasShareIntent]);

  useEffect(() => {
    if (!hasShareIntent || isHandlingIntentRef.current) {
      return;
    }

    isHandlingIntentRef.current = true;
    const operationId = operationIdRef.current + 1;
    operationIdRef.current = operationId;
    setStatus('importing');
    setMessage(null);
    setPreparationProgress(null);

    void (async () => {
      let imported: ImportedSharedFile[] = [];

      try {
        await startupCleanupPromiseRef.current;
        await cleanupImportedFiles(importedFilesRef.current);
        imported = await importSharedFiles(shareIntent.files ?? []);

        if (operationIdRef.current !== operationId) {
          await cleanupImportedFiles(imported);
          return;
        }

        replaceFiles(imported);
        setStatus('preparing');

        const prepared = await prepareSharedFiles(imported, {
          onProgress: setPreparationProgress,
          shouldCancel: () => operationIdRef.current !== operationId,
        });

        if (operationIdRef.current !== operationId) {
          await cleanupImportedFiles(prepared);
          return;
        }

        replaceFiles(prepared);
        nextTransferIndexRef.current = 0;
        setPreparationProgress(null);
        setStatus('review');
      } catch (error) {
        if (error instanceof PreparationCancelledError) {
          await cleanupImportedFiles(error.preparedFiles);
        }

        if (operationIdRef.current !== operationId) {
          await cleanupImportedFiles(imported);
          return;
        }

        replaceFiles([]);
        setMessage(
          error instanceof Error
            ? error.message
            : 'Не удалось получить общий файл.',
        );
        setStatus('error');
      } finally {
        resetShareIntent(true);
      }
    })();
  }, [
    hasShareIntent,
    replaceFiles,
    resetShareIntent,
    shareIntent.files,
  ]);

  const waitForAttachmentResult = useCallback(
    () =>
      new Promise<AttachmentBridgeResult>((resolve) => {
        if (bridgeResultTimerRef.current) {
          clearTimeout(bridgeResultTimerRef.current);
        }

        bridgeResultResolverRef.current = resolve;
        bridgeResultTimerRef.current = setTimeout(() => {
          bridgeResultResolverRef.current = null;
          bridgeResultTimerRef.current = null;
          resolve({
            message:
              'Healz не подтвердил добавление файла. Попробуйте ещё раз.',
            source: 'healz-mobile-share',
            type: 'ERROR',
          });
        }, ATTACHMENT_RESULT_TIMEOUT_MS);
      }),
    [],
  );

  const startTransfer = useCallback(async () => {
    if (
      isTransferringRef.current ||
      importedFilesRef.current.length === 0
    ) {
      return;
    }

    if (appStateRef.current !== 'active') {
      setStatus('waiting');
      return;
    }

    isTransferringRef.current = true;
    setStatus('transferring');
    setMessage(null);

    try {
      const webView = webViewRef.current;

      if (!webView) {
        throw new Error('Веб-приложение Healz ещё не готово.');
      }

      const queuedFiles = importedFilesRef.current;

      await runSequentialQueue(
        queuedFiles,
        nextTransferIndexRef.current,
        async (file, fileIndex) => {
        if (appStateRef.current !== 'active') {
          throw new TransferDeferredError('waiting');
        }

        const latestNetworkState =
          await Network.getNetworkStateAsync().catch(() => networkState);

        if (isNetworkUnavailable(latestNetworkState)) {
          throw new TransferDeferredError('offline');
        }

        const progress = getTransferProgress(
          fileIndex,
          queuedFiles.length,
        );
        setTransferProgress({
          current: progress.current,
          total: progress.total,
        });

        const payload = await createAttachmentPayload(file);
        const resultPromise = waitForAttachmentResult();
        await webView.attachSharedFiles([payload]);
        const result = await resultPromise;

        if (result.type !== 'ATTACHED') {
          throw new AttachmentTransferError(result);
        }

        if (fileIndex + 1 < queuedFiles.length) {
          await wait(BETWEEN_FILE_DELAY_MS);
        }
        },
        (nextIndex) => {
          nextTransferIndexRef.current = nextIndex;
        },
      );

      setTransferProgress(null);
      setStatus('success');
      AccessibilityInfo.announceForAccessibility(
        'Все документы добавлены в Healz.',
      );
      successTimerRef.current = setTimeout(() => {
        void resetFlow();
      }, 1800);
    } catch (error) {
      if (error instanceof TransferDeferredError) {
        setStatus(error.nextStatus);
        return;
      }

      setMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось прочитать файл перед загрузкой.',
      );
      setStatus('error');
    } finally {
      if (bridgeResultTimerRef.current) {
        clearTimeout(bridgeResultTimerRef.current);
        bridgeResultTimerRef.current = null;
      }
      bridgeResultResolverRef.current = null;
      isTransferringRef.current = false;
    }
  }, [networkState, resetFlow, waitForAttachmentResult]);

  useEffect(() => {
    if (
      status === 'waiting' &&
      appState === 'active' &&
      isHealzChatUrl(currentUrl)
    ) {
      void startTransfer();
    }
  }, [appState, currentUrl, startTransfer, status]);

  const confirmImport = () => {
    if (files.length === 0) {
      return;
    }

    if (isOffline) {
      setStatus('offline');
      return;
    }

    nextTransferIndexRef.current = 0;
    setStatus('waiting');
    webViewRef.current?.openChat();
  };

  const handleAttachmentResult = useCallback(
    (result: AttachmentBridgeResult) => {
      const resolve = bridgeResultResolverRef.current;

      if (resolve) {
        if (bridgeResultTimerRef.current) {
          clearTimeout(bridgeResultTimerRef.current);
          bridgeResultTimerRef.current = null;
        }
        bridgeResultResolverRef.current = null;
        resolve(result);
      }
    },
    [],
  );

  const retry = async () => {
    const latestNetworkState =
      await Network.getNetworkStateAsync().catch(() => networkState);

    if (isNetworkUnavailable(latestNetworkState)) {
      setStatus('offline');
      return;
    }

    isTransferringRef.current = false;
    setMessage(null);
    setStatus('waiting');

    if (isHealzChatUrl(currentUrl)) {
      void startTransfer();
    } else {
      webViewRef.current?.openChat();
    }
  };

  return (
    <View style={styles.container}>
      <HealzWebView
        ref={webViewRef}
        isOffline={isOffline}
        onAttachmentResult={handleAttachmentResult}
        onInitialContentReady={onInitialContentReady}
        onLocationChange={setCurrentUrl}
      />
      <ShareImportOverlay
        files={files}
        message={message}
        onCancel={() => void resetFlow()}
        onConfirm={confirmImport}
        onRetry={() => void retry()}
        preparationProgress={preparationProgress}
        retryLabel={
          status === 'offline' ? 'Проверить соединение' : 'Повторить'
        }
        status={status}
        transferProgress={transferProgress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
