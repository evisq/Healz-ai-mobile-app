export const MAX_SHARED_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SHARED_FILE_COUNT = 5;
export const MAX_SHARED_TOTAL_BYTES = 20 * 1024 * 1024;

export type FilePreparationReason =
  | 'already-efficient'
  | 'compressed'
  | 'compression-error'
  | 'native-module-unavailable'
  | 'output-invalid'
  | 'savings-too-small'
  | 'small-image';

export type FilePreparation = {
  message?: string;
  originalSize: number;
  reason: FilePreparationReason;
  savedBytes: number;
  status: 'compressed' | 'original';
};

export type ImportedSharedFile = {
  id: string;
  mimeType: string;
  name: string;
  originalName: string;
  originalSize: number;
  preparation: FilePreparation;
  size: number;
  temporaryUris: string[];
  uri: string;
};

export type AttachmentPayload = {
  base64: string;
  mimeType: string;
  name: string;
  size: number;
};

export type AttachmentBridgeResultType =
  | 'ATTACHED'
  | 'ERROR'
  | 'INPUT_NOT_FOUND'
  | 'MULTIPLE_NOT_SUPPORTED'
  | 'UNSUPPORTED_BROWSER';

export type AttachmentBridgeResult = {
  message?: string;
  source: 'healz-mobile-share';
  type: AttachmentBridgeResultType;
};
