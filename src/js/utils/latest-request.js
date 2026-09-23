function bindAbortSignal(request, signal) {
  const abort = () => request.abort();
  const releaseSignal = () => signal?.removeEventListener('abort', abort);
  signal?.addEventListener('abort', abort, { once: true });
  request.signal.addEventListener('abort', releaseSignal, { once: true });

  return () => {
    releaseSignal();
    request.signal.removeEventListener('abort', releaseSignal);
  };
}

function rethrow(error) {
  throw error;
}

// One scope per independently replaceable result, kept for its owner's active run.
export default function createLatestRequest({ load, commit, fail = rethrow }) {
  let pending;
  let disposed = false;

  function cancel() {
    pending?.abort();
    pending = undefined;
  }

  function canRun(signal) {
    return !disposed && !signal?.aborted;
  }

  return {
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
    async run(input, { signal } = {}) {
      if (!canRun(signal)) return false;
      cancel();
      const request = new AbortController();
      pending = request;
      const releaseSignal = bindAbortSignal(request, signal);

      try {
        const value = await load(input, { signal: request.signal });
        if (request.signal.aborted) return false;
        commit(value, input);
        return true;
      } catch(error) {
        if (request.signal.aborted) return false;
        fail(error, input);
        return false;
      } finally {
        releaseSignal();
        if (pending === request) pending = undefined;
      }
    },
  };
}
