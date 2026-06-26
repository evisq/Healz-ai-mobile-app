import { prepareImage } from './imagePipeline';
import { preparePdf } from './pdfPipeline';
import type { ImportedSharedFile } from '../sharing/types';

export class PreparationCancelledError extends Error {
  constructor(
    readonly preparedFiles: ImportedSharedFile[],
  ) {
    super('Подготовка отменена.');
    this.name = 'PreparationCancelledError';
  }
}

type PrepareSharedFilesOptions = {
  onProgress?: (progress: {
    current: number;
    fileName: string;
    total: number;
  }) => void;
  shouldCancel?: () => boolean;
};

export async function prepareSharedFiles(
  files: ImportedSharedFile[],
  options: PrepareSharedFilesOptions = {},
) {
  const prepared: ImportedSharedFile[] = [];

  for (const [index, file] of files.entries()) {
    if (options.shouldCancel?.()) {
      throw new PreparationCancelledError(prepared);
    }

    options.onProgress?.({
      current: index + 1,
      fileName: file.originalName,
      total: files.length,
    });

    let result: ImportedSharedFile;

    try {
      result =
        file.mimeType === 'application/pdf'
          ? await preparePdf(file)
          : await prepareImage(file);
    } catch {
      result = {
        ...file,
        preparation: {
          message:
            'Файл не удалось безопасно оптимизировать — отправим оригинал.',
          originalSize: file.originalSize,
          reason: 'compression-error',
          savedBytes: 0,
          status: 'original',
        },
      };
    }

    prepared.push(result);

    if (options.shouldCancel?.()) {
      throw new PreparationCancelledError(prepared);
    }
  }

  return prepared;
}
