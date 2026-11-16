export function createResponseGate(scope) {
  const drains = [];
  let release;
  // Teardown must still release gates when Cypress cancels a timed-out waiter.
  const response = new Promise(resolve => {
    release = resolve;
  });
  const gate = {
    started: false,
    release,
    get drain() {
      return Promise.all(drains);
    },
    reply(request, body, statusCode = 200) {
      this.started = true;
      const drain = response.then(() => request.reply({ body, statusCode }));
      drains.push(drain);
      return drain;
    },
  };
  scope.defer(() => {
    gate.release();
    return gate.drain;
  });
  return gate;
}

export function trackInteractionRequests(win, completions, scope) {
  const originalFetch = win.fetch;
  scope.defer(() => {
    win.fetch = originalFetch;
  });
  win.fetch = (...args) => {
    if (!String(args[0]).includes('/interactions')) return originalFetch.apply(win, args);
    let complete;
    // Native promises survive cancellation of a Cypress wait and remain drainable.
    const completion = new Promise(resolve => {
      complete = resolve;
    });
    completion.requestUrl = String(args[0]);
    completions.push(completion);
    // Use the runner's task queue (unaffected by AUT clocks or later visits).
    // After JSON decoding, application Promise continuations drain before this task.
    const signal = args[1]?.signal;
    completion.requestSignal = signal;
    const settled = () => {
      signal?.removeEventListener('abort', settled);
      setTimeout(complete, 0);
    };
    // An aborted response may never reach clone()/json(), even after headers arrive.
    signal?.addEventListener('abort', settled, { once: true });
    const trackResponse = response => {
      const originalClone = response.clone.bind(response);
      const originalJson = response.json.bind(response);
      response.clone = () => trackResponse(originalClone());
      response.json = () => {
        const body = originalJson();
        body.then(settled, settled);
        return body;
      };
      if (response.status === 204) settled();
      return response;
    };
    return originalFetch.apply(win, args).then(trackResponse, error => {
      settled();
      throw error;
    });
  };
}

export function drainInteractionRequests(completions) {
  const count = completions.length;
  return Promise.all(completions).then(() => {
    if (completions.length !== count) return drainInteractionRequests(completions);
  });
}

export function observeInteractionMessage(win, id, scope) {
  return new Promise(resolve => {
    const channel = win.Radio.channel('ws');
    const received = message => {
      if (message.resource.id !== id) return;
      channel.off('message:interactions', received);
      // Observe delivery after the feature handlers and their fetch microtasks.
      setTimeout(resolve, 0);
    };
    channel.on('message:interactions', received);
    scope.defer(() => channel.off('message:interactions', received));
  });
}
