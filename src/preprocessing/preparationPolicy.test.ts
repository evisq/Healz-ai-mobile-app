import assert from 'node:assert/strict';
import test from 'node:test';

import {
  choosePreparationCandidate,
  createImageResizeAction,
  isReadableImageResult,
  shouldPrepareImage,
} from './preparationPolicy';

test('only prepares large or heavy images', () => {
  assert.equal(shouldPrepareImage(400_000, 1200, 900), false);
  assert.equal(shouldPrepareImage(2_000_000, 2400, 1800), true);
  assert.equal(shouldPrepareImage(600_000, 4200, 3000), true);
});

test('resizes only the long image edge without upscaling', () => {
  assert.deepEqual(createImageResizeAction(4200, 3000), {
    resize: { width: 2800 },
  });
  assert.deepEqual(createImageResizeAction(2000, 4000), {
    resize: { height: 2800 },
  });
  assert.equal(createImageResizeAction(2400, 1800), null);
});

test('rejects distorted or unexpectedly small image output', () => {
  assert.equal(isReadableImageResult(4000, 3000, 2800, 2100), true);
  assert.equal(isReadableImageResult(4000, 3000, 1200, 900), false);
  assert.equal(isReadableImageResult(4000, 3000, 2800, 1800), false);
});

test('uses the smallest valid candidate only for meaningful savings', () => {
  const decision = choosePreparationCandidate(
    1_000_000,
    [
      {
        mimeType: 'image/jpeg',
        name: 'report.jpg',
        size: 650_000,
        uri: 'file://report.jpg',
      },
      {
        mimeType: 'image/png',
        name: 'report.png',
        size: 800_000,
        uri: 'file://report.png',
      },
    ],
    0.1,
  );

  assert.equal(decision.useCandidate, true);
  assert.equal(decision.savedBytes, 350_000);

  assert.deepEqual(
    choosePreparationCandidate(
      1_000_000,
      [
        {
          mimeType: 'application/pdf',
          name: 'report.pdf',
          size: 960_000,
          uri: 'file://report.pdf',
        },
      ],
      0.05,
    ),
    {
      reason: 'savings-too-small',
      savedBytes: 0,
      useCandidate: false,
    },
  );
});
