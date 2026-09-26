import createLatestRequest from './latest-request';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

context('Latest Request', function() {
  specify('commits only the latest response even when the provider ignores cancellation', async function() {
    const first = deferred();
    const second = deferred();
    const commit = cy.stub();
    const signals = [];
    const requests = createLatestRequest({
      load: (input, { signal }) => {
        signals.push(signal);
        return input.promise;
      },
      commit,
    });

    const firstRun = requests.run(first);
    const secondRun = requests.run(second);
    expect(signals[0].aborted).to.equal(true);
    second.resolve('new');
    expect(await secondRun).to.equal(true);
    first.resolve('old');
    expect(await firstRun).to.equal(false);
    expect(commit).to.have.been.calledOnceWithExactly('new', second);
  });

  specify('suppresses stale errors without losing cancellation of the newer request', async function() {
    const first = deferred();
    const second = deferred();
    const commit = cy.stub();
    const requests = createLatestRequest({ load: input => input.promise, commit });
    const firstRun = requests.run(first);
    const secondRun = requests.run(second);

    first.reject(new Error('Obsolete failure'));
    expect(await firstRun).to.equal(false);
    requests.cancel();
    second.resolve('canceled');
    expect(await secondRun).to.equal(false);
    expect(commit).not.to.have.been.called;
  });

  specify('reports current failures and allows retry', async function() {
    const error = new Error('Current failure');
    const commit = cy.stub();
    const requests = createLatestRequest({ load: input => input, commit });
    expect(await requests.run(Promise.reject(error)).catch(value => value)).to.equal(error);
    expect(await requests.run('retry')).to.equal(true);
    expect(commit).to.have.been.calledOnceWithExactly('retry', 'retry');
  });

  specify('handles current failures within the request scope and suppresses disposed failures', async function() {
    const current = deferred();
    const canceled = deferred();
    const fail = cy.stub();
    const requests = createLatestRequest({ load: input => input.promise, commit: cy.stub(), fail });
    const error = new Error('Current failure');
    const currentRun = requests.run(current);
    current.reject(error);
    expect(await currentRun).to.equal(false);
    expect(fail).to.have.been.calledOnceWithExactly(error, current);

    const canceledRun = requests.run(canceled);
    canceled.reject(new Error('Disposed failure'));
    requests.dispose();
    expect(await canceledRun).to.equal(false);
    expect(fail).to.have.been.calledOnce;
  });

  specify('releases external abort listeners and refuses work after disposal', async function() {
    const pending = deferred();
    const external = new AbortController();
    const removeListener = cy.spy(external.signal, 'removeEventListener');
    const commit = cy.stub();
    const load = cy.stub().returns(pending.promise);
    const requests = createLatestRequest({ load, commit });
    const run = requests.run('pending', { signal: external.signal });

    requests.dispose();
    expect(removeListener).to.have.been.calledOnce;
    expect(await requests.run('later')).to.equal(false);
    pending.resolve('disposed');
    expect(await run).to.equal(false);
    expect(load).to.have.been.calledOnce;
    expect(commit).not.to.have.been.called;
  });

  specify('does not replace active work with an already aborted request', async function() {
    const pending = deferred();
    const external = new AbortController();
    const commit = cy.stub();
    const requests = createLatestRequest({ load: input => input.promise, commit });
    const run = requests.run(pending);
    external.abort();

    expect(await requests.run({}, { signal: external.signal })).to.equal(false);
    pending.resolve('current');
    expect(await run).to.equal(true);
    expect(commit).to.have.been.calledOnceWithExactly('current', pending);
  });

  specify('cancels pending work when its external signal aborts', async function() {
    const pending = deferred();
    const external = new AbortController();
    const commit = cy.stub();
    const requests = createLatestRequest({ load: () => pending.promise, commit });
    const run = requests.run(null, { signal: external.signal });
    external.abort();
    pending.resolve('canceled');
    expect(await run).to.equal(false);
    expect(commit).not.to.have.been.called;
  });
});
