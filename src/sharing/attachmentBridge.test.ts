import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASE64_BRIDGE_CHUNK_SIZE,
  createAttachmentChunkScript,
  createAttachmentFinalizeScript,
  createAttachmentInitScript,
  iterateBase64Chunks,
} from './attachmentBridge';

test('splits base64 only at valid four-character boundaries', () => {
  const base64 = 'A'.repeat(BASE64_BRIDGE_CHUNK_SIZE + 20);
  const chunks = [...iterateBase64Chunks(base64)];

  assert.equal(chunks.length, 2);
  assert.equal(chunks.join(''), base64);
  assert.equal(chunks[0].length % 4, 0);
});

test('escapes metadata and chunk contents for injected JavaScript', () => {
  const init = createAttachmentInitScript([
    {
      mimeType: 'application/pdf',
      name: 'quote-"document".pdf',
      size: 42,
    },
  ]);
  const chunk = createAttachmentChunkScript(0, 'abc"\\def');

  assert.match(init, /quote-\\"document\\"\.pdf/);
  assert.match(chunk, /abc\\"\\\\def/);
  assert.match(createAttachmentFinalizeScript(), /DataTransfer/);
});
