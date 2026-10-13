/** A real deadline even when a dependency ignores AbortSignal. */
export async function withinDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", abort, { once: true });
  if (parent?.aborted) abort();
  let timer: ReturnType<typeof setTimeout>;
  let rejectAbort: () => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason ?? new Error("Scrape timed out."));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    timer = setTimeout(() => controller.abort(new Error("Scrape timed out.")), Math.max(0, milliseconds));
    if (controller.signal.aborted) rejectAbort();
  });
  try {
    return await Promise.race([Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return run(controller.signal);
    }), stopped]);
  } finally {
    clearTimeout(timer!);
    parent?.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}
