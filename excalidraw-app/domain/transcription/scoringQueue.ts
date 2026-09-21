export type RetryableScoreJob = {
  turnId: string;
  text: string;
  staleRetries?: number;
};

/** A missing context can reject synchronously: never retry it indefinitely. */
export const retryStaleScore = <Job extends RetryableScoreJob>(
  queue: Job[],
  job: Job,
): boolean => {
  if (
    (job.staleRetries ?? 0) >= 2 ||
    queue.some((pending) => pending.turnId === job.turnId)
  ) {
    return false;
  }
  queue.push({ ...job, staleRetries: (job.staleRetries ?? 0) + 1 });
  return true;
};

/** Keep completed-text metadata bounded to the retained transcript. */
export const pruneScoredText = (
  cache: Map<string, string>,
  turns: readonly { id: string }[],
) => {
  const retained = new Set(turns.map((turn) => turn.id));
  for (const id of cache.keys()) {
    if (!retained.has(id)) {
      cache.delete(id);
    }
  }
};
