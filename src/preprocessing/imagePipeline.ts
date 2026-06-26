import {
  manipulateAsync,
  SaveFormat,
} from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';

import type { ImportedSharedFile } from '../sharing/types';
import {
  choosePreparationCandidate,
  createImageResizeAction,
  IMAGE_JPEG_QUALITY,
  IMAGE_MIN_SAVINGS_RATIO,
  isReadableImageResult,
  shouldPrepareImage,
  type PreparationCandidate,
} from './preparationPolicy';

function getImageDimensions(uri: string) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ height, width }),
      reject,
    );
  });
}

async function getFileSize(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists || info.isDirectory || info.size <= 0) {
    throw new Error('Подготовленное изображение не удалось прочитать.');
  }

  return info.size;
}

function replaceExtension(name: string, extension: string) {
  const dotIndex = name.lastIndexOf('.');
  const baseName = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  return `${baseName}.${extension}`;
}

export async function prepareImage(
  file: ImportedSharedFile,
): Promise<ImportedSharedFile> {
  const originalDimensions = await getImageDimensions(file.uri);

  if (
    !shouldPrepareImage(
      file.size,
      originalDimensions.width,
      originalDimensions.height,
    )
  ) {
    return {
      ...file,
      preparation: {
        originalSize: file.originalSize,
        reason: 'small-image',
        savedBytes: 0,
        status: 'original',
      },
    };
  }

  const resizeAction = createImageResizeAction(
    originalDimensions.width,
    originalDimensions.height,
  );
  const actions = resizeAction ? [resizeAction] : [];
  const candidates: PreparationCandidate[] = [];
  const generatedUris: string[] = [];
  let selectedUri: string | null = null;

  try {
    const jpeg = await manipulateAsync(file.uri, actions, {
      compress: IMAGE_JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    generatedUris.push(jpeg.uri);
    const decodedJpeg = await getImageDimensions(jpeg.uri);

    if (
      isReadableImageResult(
        originalDimensions.width,
        originalDimensions.height,
        decodedJpeg.width,
        decodedJpeg.height,
      )
    ) {
      candidates.push({
        height: decodedJpeg.height,
        mimeType: 'image/jpeg',
        name: replaceExtension(file.originalName, 'jpg'),
        size: await getFileSize(jpeg.uri),
        uri: jpeg.uri,
        width: decodedJpeg.width,
      });
    }

    if (file.mimeType === 'image/png' && resizeAction) {
      const png = await manipulateAsync(file.uri, actions, {
        compress: 1,
        format: SaveFormat.PNG,
      });
      generatedUris.push(png.uri);
      const decodedPng = await getImageDimensions(png.uri);

      if (
        isReadableImageResult(
          originalDimensions.width,
          originalDimensions.height,
          decodedPng.width,
          decodedPng.height,
        )
      ) {
        candidates.push({
          height: decodedPng.height,
          mimeType: 'image/png',
          name: file.originalName,
          size: await getFileSize(png.uri),
          uri: png.uri,
          width: decodedPng.width,
        });
      }
    }

    const decision = choosePreparationCandidate(
      file.size,
      candidates,
      IMAGE_MIN_SAVINGS_RATIO,
    );

    if (!decision.useCandidate) {
      return {
        ...file,
        preparation: {
          originalSize: file.originalSize,
          reason: decision.reason,
          savedBytes: 0,
          status: 'original',
        },
      };
    }

    selectedUri = decision.candidate.uri;

    return {
      ...file,
      mimeType: decision.candidate.mimeType,
      name: decision.candidate.name,
      preparation: {
        originalSize: file.originalSize,
        reason: decision.reason,
        savedBytes: decision.savedBytes,
        status: 'compressed',
      },
      size: decision.candidate.size,
      temporaryUris: [...file.temporaryUris, decision.candidate.uri],
      uri: decision.candidate.uri,
    };
  } finally {
    await Promise.all(
      generatedUris
        .filter((uri) => uri !== selectedUri)
        .map((uri) =>
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(
            () => undefined,
          ),
        ),
    );
  }
}
