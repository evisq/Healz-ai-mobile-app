import type { NetworkState } from 'expo-network';

export const ATTACHMENT_RESULT_TIMEOUT_MS = 15_000;
export const BETWEEN_FILE_DELAY_MS = 650;

export function isNetworkUnavailable(
  networkState: Pick<
    NetworkState,
    'isConnected' | 'isInternetReachable'
  >,
) {
  return (
    networkState.isConnected === false ||
    networkState.isInternetReachable === false
  );
}

export function getTransferProgress(
  nextFileIndex: number,
  totalFiles: number,
) {
  const safeTotal = Math.max(0, totalFiles);
  const safeIndex = Math.min(
    Math.max(0, nextFileIndex),
    Math.max(0, safeTotal - 1),
  );

  return {
    current: safeTotal === 0 ? 0 : safeIndex + 1,
    remaining: Math.max(0, safeTotal - safeIndex),
    total: safeTotal,
  };
}

export async function runSequentialQueue<T>(
  items: readonly T[],
  startIndex: number,
  processItem: (item: T, index: number) => Promise<void>,
  onItemComplete?: (nextIndex: number) => void,
) {
  const safeStartIndex = Math.min(
    Math.max(0, startIndex),
    items.length,
  );

  for (let index = safeStartIndex; index < items.length; index += 1) {
    await processItem(items[index], index);
    onItemComplete?.(index + 1);
  }

  return items.length;
}
