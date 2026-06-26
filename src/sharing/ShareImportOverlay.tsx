import { useEffect, useMemo } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatFileSize } from './fileValidation';
import type { ImportedSharedFile } from './types';

function getPreparationNote(file: ImportedSharedFile) {
  if (file.preparation.message) {
    return file.preparation.message;
  }

  switch (file.preparation.reason) {
    case 'compressed':
      return `Сэкономлено ${formatFileSize(file.preparation.savedBytes)}.`;
    case 'small-image':
      return 'Изображение уже подходящего разрешения.';
    case 'savings-too-small':
    case 'already-efficient':
      return 'Сжатие не дало заметной экономии — оставлен оригинал.';
    case 'output-invalid':
      return 'Результат проверки отклонён — оставлен оригинал.';
    case 'compression-error':
    case 'native-module-unavailable':
      return 'Безопасное сжатие недоступно — оставлен оригинал.';
  }
}

export type ShareFlowStatus =
  | 'error'
  | 'idle'
  | 'importing'
  | 'offline'
  | 'preparing'
  | 'review'
  | 'success'
  | 'transferring'
  | 'waiting';

type ShareImportOverlayProps = {
  files: ImportedSharedFile[];
  message: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRetry: () => void;
  preparationProgress: {
    current: number;
    fileName: string;
    total: number;
  } | null;
  retryLabel?: string;
  status: ShareFlowStatus;
  transferProgress: {
    current: number;
    total: number;
  } | null;
};

export function ShareImportOverlay({
  files,
  message,
  onCancel,
  onConfirm,
  onRetry,
  preparationProgress,
  retryLabel = 'Повторить',
  status,
  transferProgress,
}: ShareImportOverlayProps) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(
    () => createStyles(isDark, insets.bottom),
    [insets.bottom, isDark],
  );

  useEffect(() => {
    const announcement =
      status === 'preparing' && preparationProgress
        ? `Подготовка файла ${preparationProgress.current} из ${preparationProgress.total}`
        : status === 'transferring' && transferProgress
          ? `Добавление файла ${transferProgress.current} из ${transferProgress.total}`
          : status === 'offline'
            ? 'Нет подключения к интернету. Документы сохранены.'
            : null;

    if (announcement) {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [preparationProgress, status, transferProgress]);

  if (status === 'idle') {
    return null;
  }

  if (
    status === 'waiting' ||
    status === 'transferring' ||
    status === 'success'
  ) {
    const title =
      status === 'waiting'
        ? 'Откройте чат Healz'
        : status === 'transferring'
          ? 'Добавляем документ…'
          : 'Документ добавлен';
    const description =
      status === 'waiting'
        ? 'Если вы ещё не вошли, завершите вход — вложение будет добавлено в чате.'
        : status === 'transferring'
          ? transferProgress
            ? `Файл ${transferProgress.current} из ${transferProgress.total}. Не закрывайте приложение.`
            : 'Не закрывайте приложение, пока файл передаётся в WebView.'
          : 'Файл передан штатному загрузчику Healz.';

    return (
      <View pointerEvents="box-none" style={styles.bannerLayer}>
        <View
          accessibilityLiveRegion="polite"
          accessible
          style={styles.banner}
        >
          {status !== 'success' ? (
            <ActivityIndicator color="#A94D6F" size="small" />
          ) : (
            <View style={styles.successMark}>
              <Text style={styles.successMarkText}>✓</Text>
            </View>
          )}
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{title}</Text>
            <Text style={styles.bannerDescription}>{description}</Text>
          </View>
          {status === 'waiting' ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={onCancel}
            >
              <Text style={styles.cancelLink}>Отмена</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const isImporting = status === 'importing';
  const isPreparing = status === 'preparing';
  const isBusy = isImporting || isPreparing;
  const isError = status === 'error';
  const isOffline = status === 'offline';
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const originalTotalSize = files.reduce(
    (sum, file) => sum + file.originalSize,
    0,
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalLayer}
    >
      <Pressable
        accessibilityLabel="Закрыть импорт"
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.backdrop}
      />
      <View
        accessibilityViewIsModal
        style={styles.card}
      >
        <View style={styles.handle} />
        <Text style={styles.cardTitle}>
          {isImporting
            ? 'Получаем документ…'
            : isPreparing
              ? 'Подготавливаем документ…'
              : isOffline
                ? 'Нет подключения к интернету'
              : isError
                ? 'Не удалось добавить файл'
                : 'Добавить в Healz?'}
        </Text>

        {isBusy ? (
          <View
            accessibilityLabel={
              isImporting
                ? 'Получаем документы'
                : preparationProgress
                  ? `Подготовка файла ${preparationProgress.current} из ${preparationProgress.total}`
                  : 'Подготавливаем документы'
            }
            accessibilityLiveRegion="polite"
            accessibilityRole="progressbar"
            accessibilityValue={
              preparationProgress
                ? {
                    max: preparationProgress.total,
                    min: 1,
                    now: preparationProgress.current,
                  }
                : undefined
            }
            style={styles.importing}
          >
            <ActivityIndicator
              accessibilityLabel="Обработка выполняется"
              color={isDark ? '#E4AFC3' : '#A94D6F'}
              size="large"
            />
            <Text accessibilityLiveRegion="polite" style={styles.cardDescription}>
              {isImporting
                ? 'Копируем общий файл во внутренний cache приложения.'
                : preparationProgress
                  ? `${preparationProgress.current} из ${preparationProgress.total}: ${preparationProgress.fileName}`
                  : 'Уменьшаем размер локально, сохраняя читаемость текста и цифр.'}
            </Text>
            <Pressable
              accessibilityHint="Остановит подготовку и удалит временные копии"
              accessibilityLabel="Отменить подготовку документов"
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.busyCancelButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Отмена</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.cardDescription}>
              {isOffline
                ? 'Подготовленные документы сохранены. Подключитесь к сети и повторите отправку.'
                : isError
                ? message
                : 'Подготовка выполнена локально. Оригинал используется, если сжатие не даёт безопасной экономии.'}
            </Text>

            {files.length > 0 ? (
              <View style={styles.fileList}>
                {files.map((file) => (
                  <View key={file.id} style={styles.fileRow}>
                    <View style={styles.fileIcon}>
                      <Text style={styles.fileIconText}>
                        {file.mimeType === 'application/pdf' ? 'PDF' : 'IMG'}
                      </Text>
                    </View>
                    <View style={styles.fileText}>
                      <Text numberOfLines={1} style={styles.fileName}>
                        {file.name}
                      </Text>
                      <Text style={styles.fileSize}>
                        {file.preparation.status === 'compressed'
                          ? `${formatFileSize(file.originalSize)} → ${formatFileSize(file.size)}`
                          : `${formatFileSize(file.size)} · оригинал`}
                      </Text>
                      {getPreparationNote(file) ? (
                        <Text numberOfLines={2} style={styles.fileNote}>
                          {getPreparationNote(file)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
                {files.length > 1 ? (
                  <Text style={styles.totalSize}>
                    Всего:{' '}
                    {originalTotalSize !== totalSize
                      ? `${formatFileSize(originalTotalSize)} → `
                      : ''}
                    {formatFileSize(totalSize)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.actions}>
              {(isError || isOffline) && files.length > 0 ? (
                <Pressable
                  accessibilityHint="Проверит соединение и продолжит с первого неотправленного файла"
                  accessibilityLabel={retryLabel}
                  accessibilityRole="button"
                  onPress={onRetry}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>{retryLabel}</Text>
                </Pressable>
              ) : !isError ? (
                <Pressable
                  accessibilityHint="Откроет чат и последовательно добавит документы"
                  accessibilityLabel="Добавить документы в Healz"
                  accessibilityRole="button"
                  onPress={onConfirm}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    Добавить в Healz
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityHint="Удалит временные копии документов"
                accessibilityLabel="Отменить отправку документов"
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {isError || isOffline ? 'Закрыть' : 'Отмена'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(isDark: boolean, safeBottom: number) {
  const colors = isDark
    ? {
        accent: '#E4AFC3',
        accentMuted: '#593B48',
        backdrop: 'rgba(0, 0, 0, 0.62)',
        border: '#594C53',
        button: '#E7DDE1',
        buttonText: '#2A2226',
        note: '#D6AABE',
        row: '#352B30',
        secondaryText: '#C8BBC2',
        surface: '#241E21',
        text: '#F7EFF3',
      }
    : {
        accent: '#A94D6F',
        accentMuted: '#E9CED9',
        backdrop: 'rgba(35, 27, 32, 0.42)',
        border: '#DED4D9',
        button: '#4B4040',
        buttonText: '#FFFFFF',
        note: '#8B6675',
        row: '#F9F1F4',
        secondaryText: '#6B6168',
        surface: '#FFFDFE',
        text: '#2D262E',
      };

  return StyleSheet.create({
  bannerLayer: {
    bottom: safeBottom + 12,
    left: 14,
    position: 'absolute',
    right: 14,
    zIndex: 70,
  },
  banner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: '#3A2630',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  bannerDescription: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  cancelLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  successMark: {
    alignItems: 'center',
    backgroundColor: '#DDEFE3',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  successMarkText: {
    color: '#2C7747',
    fontSize: 17,
    fontWeight: '800',
  },
  modalLayer: {
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 80,
  },
  backdrop: {
    backgroundColor: colors.backdrop,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Math.max(20, safeBottom + 12),
    paddingHorizontal: 22,
    paddingTop: 11,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: 2,
    height: 4,
    marginBottom: 20,
    width: 42,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardDescription: {
    color: colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 9,
    textAlign: 'center',
  },
  importing: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 30,
  },
  busyCancelButton: {
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 12,
    minWidth: 140,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  fileList: {
    gap: 9,
    marginTop: 20,
  },
  fileRow: {
    alignItems: 'center',
    backgroundColor: colors.row,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  fileIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  fileIconText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  fileText: {
    flex: 1,
  },
  fileName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    color: colors.secondaryText,
    fontSize: 12,
    marginTop: 3,
  },
  fileNote: {
    color: colors.note,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  totalSize: {
    color: colors.secondaryText,
    fontSize: 12,
    textAlign: 'right',
  },
  actions: {
    gap: 9,
    marginTop: 22,
  },
  primaryButton: {
    backgroundColor: colors.button,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.buttonText,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  scrollContent: {
    paddingBottom: 2,
  },
  });
}
