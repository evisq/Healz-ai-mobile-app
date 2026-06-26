import {
  type ImportedSharedFile,
  MAX_SHARED_FILE_BYTES,
  MAX_SHARED_FILE_COUNT,
  MAX_SHARED_TOTAL_BYTES,
} from './types';

export class SharedFileError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'EMPTY'
      | 'INVALID_TYPE'
      | 'MISSING_FILE'
      | 'TOO_LARGE'
      | 'TOO_MANY',
  ) {
    super(message);
    this.name = 'SharedFileError';
  }
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function getExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

export function normalizeMimeType(mimeType: string, fileName: string) {
  const normalized = mimeType.trim().toLowerCase();

  if (normalized && normalized !== 'application/octet-stream') {
    return normalized;
  }

  return MIME_BY_EXTENSION[getExtension(fileName)] ?? normalized;
}

export function isSupportedSharedFile(mimeType: string, fileName: string) {
  const normalized = normalizeMimeType(mimeType, fileName);
  return (
    normalized === 'application/pdf' ||
    SUPPORTED_IMAGE_MIME_TYPES.has(normalized)
  );
}

export function validateSharedFileMetadata(
  files: Array<Pick<ImportedSharedFile, 'mimeType' | 'name' | 'size'>>,
) {
  if (files.length === 0) {
    throw new SharedFileError(
      'В Share Intent нет PDF или изображения.',
      'EMPTY',
    );
  }

  if (files.length > MAX_SHARED_FILE_COUNT) {
    throw new SharedFileError(
      `Можно отправить не больше ${MAX_SHARED_FILE_COUNT} файлов за раз.`,
      'TOO_MANY',
    );
  }

  let totalSize = 0;

  for (const file of files) {
    if (!isSupportedSharedFile(file.mimeType, file.name)) {
      throw new SharedFileError(
        `Файл «${file.name}» не является поддерживаемым PDF или изображением.`,
        'INVALID_TYPE',
      );
    }

    if (file.size > MAX_SHARED_FILE_BYTES) {
      throw new SharedFileError(
        `Файл «${file.name}» превышает лимит Healz в 20 МБ.`,
        'TOO_LARGE',
      );
    }

    totalSize += file.size;
  }

  if (totalSize > MAX_SHARED_TOTAL_BYTES) {
    throw new SharedFileError(
      'Общий размер выбранных файлов превышает 20 МБ.',
      'TOO_LARGE',
    );
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function collectTemporaryUris(
  files: Array<Pick<ImportedSharedFile, 'temporaryUris' | 'uri'>>,
) {
  return [
    ...new Set(
      files.flatMap((file) => [...file.temporaryUris, file.uri]),
    ),
  ];
}
