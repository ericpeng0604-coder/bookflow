type GuardEntry = {
  promise: Promise<unknown>;
  abort: () => void;
};

const inFlight = new Map<string, GuardEntry>();

export function runGuarded<T>(key: string, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
  inFlight.get(key)?.abort();

  const controller = new AbortController();
  const promise = task(controller.signal).finally(() => {
    const current = inFlight.get(key);
    if (current?.promise === promise) {
      inFlight.delete(key);
    }
  });

  inFlight.set(key, {
    promise,
    abort: () => controller.abort(),
  });

  return promise;
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
