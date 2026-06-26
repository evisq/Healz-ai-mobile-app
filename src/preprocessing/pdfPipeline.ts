import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';

import type { ImportedSharedFile } from '../sharing/types';
import {
  choosePreparationCandidate,
  PDF_IMAGE_JPEG_QUALITY,
  PDF_IMAGE_MAX_LONG_EDGE,
  PDF_MIN_SAVINGS_RATIO,
} from './preparationPolicy';

type PdfCompressionResult = {
  imagesProcessed: number;
  outputSize: number;
  pageCount: number;
};

type HealzPdfCompressorModule = {
  compressAsync(
    inputUri: string,
    outputUri: string,
    options: {
      imageQuality: number;
      maxImageDimension: number;
    },
  ): Promise<PdfCompressionResult>;
};

const PdfCompressor =
  requireOptionalNativeModule<HealzPdfCompressorModule>(
    'HealzPdfCompressor',
  );

function createOutputUri() {
  if (!FileSystem.cacheDirectory) {
    throw new Error('App cache directory is unavailable');
  }

  return `${FileSystem.cacheDirectory}prepared-documents/pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
}

export async function preparePdf(
  file: ImportedSharedFile,
): Promise<ImportedSharedFile> {
  if (!PdfCompressor) {
    return {
      ...file,
      preparation: {
        message:
          'PDF-компрессор будет доступен после следующей нативной сборки.',
        originalSize: file.originalSize,
        reason: 'native-module-unavailable',
        savedBytes: 0,
        status: 'original',
      },
    };
  }

  const outputDirectory = `${FileSystem.cacheDirectory}prepared-documents/`;
  await FileSystem.makeDirectoryAsync(outputDirectory, {
    intermediates: true,
  });

  const outputUri = createOutputUri();

  try {
    const result = await PdfCompressor.compressAsync(file.uri, outputUri, {
      imageQuality: PDF_IMAGE_JPEG_QUALITY,
      maxImageDimension: PDF_IMAGE_MAX_LONG_EDGE,
    });
    const decision = choosePreparationCandidate(
      file.size,
      [
        {
          mimeType: 'application/pdf',
          name: file.originalName,
          size: result.outputSize,
          uri: outputUri,
        },
      ],
      PDF_MIN_SAVINGS_RATIO,
    );

    if (
      !decision.useCandidate ||
      result.pageCount < 1 ||
      result.imagesProcessed < 1
    ) {
      await FileSystem.deleteAsync(outputUri, { idempotent: true });

      return {
        ...file,
        preparation: {
          originalSize: file.originalSize,
          reason:
            result.pageCount < 1
              ? 'output-invalid'
              : result.imagesProcessed < 1
                ? 'already-efficient'
                : decision.reason,
          savedBytes: 0,
          status: 'original',
        },
      };
    }

    return {
      ...file,
      preparation: {
        message: `Оптимизировано изображений: ${result.imagesProcessed}.`,
        originalSize: file.originalSize,
        reason: 'compressed',
        savedBytes: decision.savedBytes,
        status: 'compressed',
      },
      size: result.outputSize,
      temporaryUris: [...file.temporaryUris, outputUri],
      uri: outputUri,
    };
  } catch {
    await FileSystem.deleteAsync(outputUri, { idempotent: true }).catch(
      () => undefined,
    );

    return {
      ...file,
      preparation: {
        message:
          'PDF не удалось безопасно оптимизировать — отправим оригинал.',
        originalSize: file.originalSize,
        reason: 'compression-error',
        savedBytes: 0,
        status: 'original',
      },
    };
  }
}
