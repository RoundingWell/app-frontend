import Backbone from 'backbone';

import { readSnapshot, visibleHistory } from './history';
import { refreshLatestWindow, extendConnectedWindow } from './connected-window';

function model(id, timestamp, attributes = {}) {
  const row = new Backbone.Model({ id, occurred_at: timestamp, ...attributes });
  row.getTimestamp = () => row.get('occurred_at') || row.get('expected_at');
  return row;
}

context('synthetic history coverage', function() {
  specify('scans raw hidden-only pages and requires a terminal verification read', async function() {
    const rows = Array.from({ length: 30 }, (value, index) => model(String(index).padStart(3, '0'), `2026-11-${ String(index + 1).padStart(2, '0') }T12:00:00Z`)).reverse();
    const reads = [];
    const result = await readSnapshot(async({ before, limit }) => {
      reads.push(before);
      const start = before ? rows.findIndex(row => row.id === before) + 1 : 0;
      return rows.slice(start, start + limit);
    }, { signal: new AbortController().signal });
    expect(result).to.have.length(30);
    expect(reads).to.have.length(4);
    const visible = visibleHistory(result, row => ({ kind: 'message', actionId: row.id === '029' ? 'current' : 'other' }), 'current', Date.parse('2026-11-01T00:00:00Z'));
    expect(visible).to.have.length(30);
    const future = model('future', null, { expected_at: '2099-11-01T12:00:00Z' });
    expect(visibleHistory([future], () => ({ kind: 'message', actionId: 'other' }), 'current')).to.have.length(0);
    expect(visibleHistory([future], () => ({ kind: 'message', actionId: 'current' }), 'current')).to.have.length(1);
  });

  specify('retains cancellation inline at native cancellation time and keeps audit rows', function() {
    const cancelled = model('cancelled', null, { expected_at: '2099-11-01T00:00:00Z', cancelled_at: '2026-10-01T00:00:00Z' });
    const newer = model('newer', '2026-11-01T00:00:00Z');
    const audit = model('audit', '2026-10-02T00:00:00Z');
    const result = visibleHistory([newer, cancelled, audit], row => ({ kind: row.id === 'audit' ? 'consent_audit' : 'message' }), 'action');
    expect(result.map(row => row.id)).to.deep.equal(['cancelled', 'audit', 'newer']);
  });

  specify('fails visibly at the budget and rejects positions changed during later reads', async function() {
    const signal = new AbortController().signal;
    let error;
    try {
      await readSnapshot(async() => [model('new', '2026-11-01T00:00:00Z')], { signal, pageLimit: 1, maxPages: 1 });
    } catch(failure) {
      error = failure;
    }
    expect(error.message).to.include('incomplete');
    const first = model('first', '2026-11-02T00:00:00Z');
    let reads = 0;
    try {
      await readSnapshot(async() => {
        if (++reads === 1) return [first];
        first.set('occurred_at', '2099-11-01T00:00:00Z');
        return [];
      }, { signal, pageLimit: 1 });
    } catch(failure) {
      error = failure;
    }
    expect(error.message).to.include('changed');
  });

  specify('reconciles a send below a future-only window without making a discontinuous paging boundary', async function() {
    const future = model('future', '2099-11-01T00:00:00Z');
    const sent = model('sent', '2026-11-01T00:00:00Z');
    const signal = new AbortController().signal;
    const reads = [];
    const window = await refreshLatestWindow({ models: [future], hasOlder: false }, [sent], async query => {
      reads.push(query);
      return query.before ? [] : [future, sent];
    }, { signal, limit: 2 });
    expect(window.models.map(row => row.id)).to.deep.equal(['sent', 'future']);
    expect(window).to.include({ hasOlder: false, hasNewer: false });
    expect(reads).to.have.length(2);
  });

  context('connected historical reconciliation', function() {
    function dataset(count = 12) {
      return Array.from({ length: count }, (value, index) => model(String(index).padStart(3, '0'), new Date(Date.UTC(2026, 10, 1, 0, index)).toISOString()));
    }
    function reader(rows, reads) {
      return async query => {
        reads.push(query);
        const index = rows.findIndex(row => row.id === (query.before || query.after));
        return query.after ? rows.slice(index + 1, index + 1 + query.limit) : rows.slice(0, index).reverse().slice(0, query.limit);
      };
    }

    specify('fills both gaps in connected pages and leaves unknown outer intervals intact', async function() {
      const rows = dataset();
      const reads = [];
      const result = await extendConnectedWindow({ models: rows.slice(4, 7), hasOlder: true, hasNewer: true }, [rows[1], rows[10]], reader(rows, reads), { signal: new AbortController().signal, limit: 2 });
      expect(result.models.map(row => row.id)).to.deep.equal(rows.slice(0, 11).map(row => row.id));
      expect(result).to.include({ hasOlder: true, hasNewer: true });
      expect(reads.map(query => query.after || query.before)).to.deep.equal(['004', '002', '006', '008']);
    });

    specify('re-proves a complete future-only edge, and inserts equal-time IDs in tuple order', async function() {
      const rows = dataset(4);
      const result = await extendConnectedWindow({ models: [rows[3]], hasOlder: false, hasNewer: false }, [rows[1]], reader(rows, []), { signal: new AbortController().signal, limit: 2 });
      expect(result.models).to.deep.equal(rows);
      expect(result).to.include({ hasOlder: false, hasNewer: false });
      const a = model('a', rows[0].getTimestamp());
      const b = model('b', rows[0].getTimestamp());
      const c = model('c', rows[0].getTimestamp());
      const tied = await extendConnectedWindow({ models: [a, c], hasOlder: true, hasNewer: true }, [b], async() => {
        throw new Error('No gap exists.');
      }, { signal: new AbortController().signal });
      expect(tied.models).to.deep.equal([a, b, c]);
    });

    specify('fails without committing a partial gap when the budget, required row or mutable order changes', async function() {
      const rows = dataset();
      const window = { models: rows.slice(0, 2), hasOlder: false, hasNewer: true };
      let error;
      try {
        await extendConnectedWindow(window, [rows[10]], reader(rows, []), { signal: new AbortController().signal, limit: 2, maxPages: 1 });
      } catch(failure) {
        error = failure;
      }
      expect(error.message).to.include('incomplete');
      expect(window.models).to.have.length(2);
      try {
        await extendConnectedWindow(window, [model('missing', rows[11].getTimestamp())], reader(rows, []), { signal: new AbortController().signal, limit: 2 });
      } catch(failure) {
        error = failure;
      }
      expect(error.message).to.include('not covered');
      const read = reader(rows, []);
      try {
        await extendConnectedWindow(window, [rows[10]], async query => {
          const page = await read(query);
          if (query.after === '005') rows[2].set('occurred_at', '2099-01-01T00:00:00Z');
          return page;
        }, { signal: new AbortController().signal, limit: 2 });
      } catch(failure) {
        error = failure;
      }
      expect(error.message).to.match(/ordered|moved/);
    });
  });
});
