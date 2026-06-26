import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTransferProgress,
  isNetworkUnavailable,
  runSequentialQueue,
} from './transferPolicy';

test('treats only explicit disconnected states as offline', () => {
  assert.equal(
    isNetworkUnavailable({
      isConnected: false,
      isInternetReachable: false,
    }),
    true,
  );
  assert.equal(
    isNetworkUnavailable({
      isConnected: true,
      isInternetReachable: false,
    }),
    true,
  );
  assert.equal(
    isNetworkUnavailable({
      isConnected: undefined,
      isInternetReachable: undefined,
    }),
    false,
  );
});

test('keeps queue progress within valid file bounds', () => {
  assert.deepEqual(getTransferProgress(0, 5), {
    current: 1,
    remaining: 5,
    total: 5,
  });
  assert.deepEqual(getTransferProgress(3, 5), {
    current: 4,
    remaining: 2,
    total: 5,
  });
  assert.deepEqual(getTransferProgress(9, 5), {
    current: 5,
    remaining: 1,
    total: 5,
  });
});

test('processes files one at a time and resumes from the next index', async () => {
  const active: number[] = [];
  const processed: number[] = [];
  const checkpoints: number[] = [];

  await runSequentialQueue(
    [0, 1, 2, 3],
    1,
    async (item) => {
      active.push(item);
      assert.equal(active.length, 1);
      await Promise.resolve();
      processed.push(item);
      active.pop();
    },
    (nextIndex) => checkpoints.push(nextIndex),
  );

  assert.deepEqual(processed, [1, 2, 3]);
  assert.deepEqual(checkpoints, [2, 3, 4]);
});
