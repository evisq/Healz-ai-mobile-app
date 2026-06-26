import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectTemporaryUris,
  isSupportedSharedFile,
  normalizeMimeType,
  SharedFileError,
  validateSharedFileMetadata,
} from './fileValidation';
import { MAX_SHARED_FILE_BYTES } from './types';

test('accepts medical document image formats and PDF', () => {
  assert.equal(isSupportedSharedFile('application/pdf', 'labs.pdf'), true);
  assert.equal(isSupportedSharedFile('image/jpeg', 'scan.jpg'), true);
  assert.equal(isSupportedSharedFile('', 'screen.PNG'), true);
  assert.equal(
    normalizeMimeType('application/octet-stream', 'report.pdf'),
    'application/pdf',
  );
});

test('rejects unrelated file types', () => {
  assert.equal(isSupportedSharedFile('video/mp4', 'clip.mp4'), false);
  assert.equal(isSupportedSharedFile('text/plain', 'notes.txt'), false);
  assert.throws(
    () =>
      validateSharedFileMetadata([
        { mimeType: 'text/plain', name: 'notes.txt', size: 10 },
      ]),
    (error) =>
      error instanceof SharedFileError && error.code === 'INVALID_TYPE',
  );
});

test('enforces the Healz 20 MB bridge limit', () => {
  assert.throws(
    () =>
      validateSharedFileMetadata([
        {
          mimeType: 'application/pdf',
          name: 'large.pdf',
          size: MAX_SHARED_FILE_BYTES + 1,
        },
      ]),
    (error) =>
      error instanceof SharedFileError && error.code === 'TOO_LARGE',
  );
});

test('collects original and prepared cache files exactly once', () => {
  assert.deepEqual(
    collectTemporaryUris([
      {
        temporaryUris: [
          'file://original.pdf',
          'file://prepared.pdf',
        ],
        uri: 'file://prepared.pdf',
      },
      {
        temporaryUris: ['file://image.jpg'],
        uri: 'file://image.jpg',
      },
    ]),
    [
      'file://original.pdf',
      'file://prepared.pdf',
      'file://image.jpg',
    ],
  );
});
