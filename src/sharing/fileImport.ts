import type { ShareIntentFile } from 'expo-share-intent';
import * as FileSystem from 'expo-file-system/legacy';

import {
  type AttachmentPayload,
  type ImportedSharedFile,
  MAX_SHARED_FILE_COUNT,
} from './types';
import {
  collectTemporaryUris,
  normalizeMimeType,
  SharedFileError,
  validateSharedFileMetadata,
} from './fileValidation';

function normalizeSourceUri(path: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    return path;
  }

  return `file://${path}`;
}

function safeFileName(fileName: string, index: number) {
  const fallback = `document-${index + 1}`;
  const cleaned = fileName
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  return cleaned || fallback;
}

async function resolveFileSize(uri: string, reportedSize: number | null) {
  if (typeof reportedSize === 'number' && reportedSize > 0) {
    return reportedSize;
  }

  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists || info.isDirectory) {
    throw new SharedFileError('Общий файл больше недоступен.', 'MISSING_FILE');
  }

  return info.size;
}

export async function importSharedFiles(
  sharedFiles: ShareIntentFile[],
): Promise<ImportedSharedFile[]> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('App cache directory is unavailable');
  }

  if (sharedFiles.length === 0) {
    validateSharedFileMetadata([]);
  }

  if (sharedFiles.length > MAX_SHARED_FILE_COUNT) {
    throw new SharedFileError(
      `Можно отправить не больше ${MAX_SHARED_FILE_COUNT} файлов за раз.`,
      'TOO_MANY',
    );
  }

  const importDirectory = `${FileSystem.cacheDirectory}shared-imports/`;
  await FileSystem.makeDirectoryAsync(importDirectory, {
    intermediates: true,
  });

  const imported: ImportedSharedFile[] = [];

  try {
    for (const [index, source] of sharedFiles.entries()) {
      const name = safeFileName(source.fileName, index);
      const mimeType = normalizeMimeType(source.mimeType, name);
      const sourceUri = normalizeSourceUri(source.path);
      const size = await resolveFileSize(sourceUri, source.size);

      validateSharedFileMetadata([
        ...imported,
        { mimeType, name, size },
      ]);

      const destination = `${importDirectory}${Date.now()}-${index}-${encodeURIComponent(name)}`;
      await FileSystem.copyAsync({ from: sourceUri, to: destination });
      const copiedSize = await resolveFileSize(destination, null);

      try {
        validateSharedFileMetadata([
          ...imported,
          { mimeType, name, size: copiedSize },
        ]);

        imported.push({
          id: `${Date.now()}-${index}`,
          mimeType,
          name,
          originalName: name,
          originalSize: copiedSize,
          preparation: {
            originalSize: copiedSize,
            reason: 'already-efficient',
            savedBytes: 0,
            status: 'original',
          },
          size: copiedSize,
          temporaryUris: [destination],
          uri: destination,
        });
      } catch (error) {
        await FileSystem.deleteAsync(destination, { idempotent: true });
        throw error;
      }
    }

    validateSharedFileMetadata(imported);
    return imported;
  } catch (error) {
    await cleanupImportedFiles(imported);
    throw error;
  }
}

export async function createAttachmentPayload(
  file: ImportedSharedFile,
): Promise<AttachmentPayload> {
  validateSharedFileMetadata([file]);

  return {
    base64: await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    }),
    mimeType: file.mimeType,
    name: file.name,
    size: file.size,
  };
}

export async function cleanupSharedCache() {
  if (!FileSystem.cacheDirectory) {
    return;
  }

  await Promise.all(
    ['shared-imports', 'prepared-documents'].map((directory) =>
      FileSystem.deleteAsync(
        `${FileSystem.cacheDirectory}${directory}/`,
        { idempotent: true },
      ).catch(() => undefined),
    ),
  );
}

export async function cleanupImportedFiles(files: ImportedSharedFile[]) {
  const uris = collectTemporaryUris(files);

  await Promise.all(
    uris.map((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(
        () => undefined,
      ),
    ),
  );
}
