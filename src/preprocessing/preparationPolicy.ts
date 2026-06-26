import type { FilePreparationReason } from '../sharing/types';

export const IMAGE_JPEG_QUALITY = 0.86;
export const IMAGE_MAX_LONG_EDGE = 2800;
export const IMAGE_MIN_LONG_EDGE_TO_REENCODE = 1600;
export const IMAGE_MIN_SIZE_TO_REENCODE = 900 * 1024;
export const IMAGE_MIN_SAVINGS_RATIO = 0.1;
export const PDF_IMAGE_JPEG_QUALITY = 0.86;
export const PDF_IMAGE_MAX_LONG_EDGE = 2800;
export const PDF_MIN_SAVINGS_RATIO = 0.03;

export type PreparationCandidate = {
  height?: number;
  mimeType: string;
  name: string;
  size: number;
  uri: string;
  width?: number;
};

export type PreparationDecision =
  | {
      candidate: PreparationCandidate;
      reason: 'compressed';
      savedBytes: number;
      useCandidate: true;
    }
  | {
      reason: FilePreparationReason;
      savedBytes: 0;
      useCandidate: false;
    };

export function shouldPrepareImage(
  size: number,
  width: number,
  height: number,
) {
  const longEdge = Math.max(width, height);

  return (
    longEdge > IMAGE_MAX_LONG_EDGE ||
    (longEdge >= IMAGE_MIN_LONG_EDGE_TO_REENCODE &&
      size >= IMAGE_MIN_SIZE_TO_REENCODE)
  );
}

export function createImageResizeAction(width: number, height: number) {
  const longEdge = Math.max(width, height);

  if (longEdge <= IMAGE_MAX_LONG_EDGE) {
    return null;
  }

  return width >= height
    ? { resize: { width: IMAGE_MAX_LONG_EDGE } }
    : { resize: { height: IMAGE_MAX_LONG_EDGE } };
}

export function isReadableImageResult(
  originalWidth: number,
  originalHeight: number,
  resultWidth: number,
  resultHeight: number,
) {
  if (
    !Number.isFinite(resultWidth) ||
    !Number.isFinite(resultHeight) ||
    resultWidth <= 0 ||
    resultHeight <= 0
  ) {
    return false;
  }

  const expectedAspect = originalWidth / originalHeight;
  const resultAspect = resultWidth / resultHeight;
  const aspectDrift = Math.abs(resultAspect - expectedAspect) / expectedAspect;
  const originalLongEdge = Math.max(originalWidth, originalHeight);
  const resultLongEdge = Math.max(resultWidth, resultHeight);

  return (
    aspectDrift <= 0.02 &&
    resultLongEdge >= Math.min(originalLongEdge, IMAGE_MAX_LONG_EDGE) * 0.98
  );
}

export function choosePreparationCandidate(
  originalSize: number,
  candidates: PreparationCandidate[],
  minimumSavingsRatio: number,
): PreparationDecision {
  const validCandidates = candidates
    .filter((candidate) => candidate.size > 0)
    .sort((left, right) => left.size - right.size);
  const candidate = validCandidates[0];

  if (!candidate || candidate.size >= originalSize) {
    return {
      reason: validCandidates.length === 0
        ? 'output-invalid'
        : 'already-efficient',
      savedBytes: 0,
      useCandidate: false,
    };
  }

  const savingsRatio = (originalSize - candidate.size) / originalSize;

  if (savingsRatio < minimumSavingsRatio) {
    return {
      reason: 'savings-too-small',
      savedBytes: 0,
      useCandidate: false,
    };
  }

  return {
    candidate,
    reason: 'compressed',
    savedBytes: originalSize - candidate.size,
    useCandidate: true,
  };
}
