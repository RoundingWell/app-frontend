import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Application } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

// The real app uses these small records; feature state belongs in options.
for (const field of ['workspace', 'patientId', 'programId', 'flowId']) {
  test(`the app's ${ field } key reuses equal records and snapshots caller mutation`, async() => {
    const starts = [];
    const pages = new ChildAppSwitcher();
    const page = pages.addChildApp('page', new (Application.extend({
      onStart(_app, options) {
        starts.push(options.id);
      },
    }))());
    try {
      await pages.start();
      const key = { [field]: 'one' };
      assert.equal(await pages.switchTo('page', { key, options: { id: 'one' } }), page);
      key[field] = 'two';
      assert.equal(await pages.switchTo('page', { key: { [field]: 'one' }, options: { id: 'ignored' } }), page);
      assert.deepEqual(starts, ['one'], 'equal fresh app keys must reuse the running feature');
      assert.equal(await pages.switchTo('page', { key, options: { id: 'two' } }), page);
      assert.deepEqual(starts, ['one', 'two']);
      assert.deepEqual(key, { [field]: 'two' }, 'snapshotting must not freeze or change caller keys');
    } finally {
      pages.destroy();
    }
  });
}

test('selection captures a resource key before child lifecycle callbacks', async() => {
  const key = { patientId: 'one' };
  let starts = 0;
  const pages = new ChildAppSwitcher();
  pages.addChildApp('patient', new (Application.extend({
    onBeforeStart() {
      starts++;
      key.patientId = 'two';
    },
  }))());
  try {
    await pages.start();
    await pages.switchTo('patient', { key });
    await pages.switchTo('patient', { key: { patientId: 'one' } });
    assert.equal(starts, 1, 'lifecycle mutation must not change the selected identity');
  } finally {
    pages.destroy();
  }
});

test('sparse keys differ from explicit undefined and invalid keys preserve pending selection', async() => {
  const work = Promise.withResolvers();
  let starts = 0;
  let getters = 0;
  const pages = new ChildAppSwitcher();
  const page = pages.addChildApp('page', new (Application.extend({
    prepareStart() {
      starts++;
      return work.promise;
    },
  }))());
  try {
    await pages.start();
    const selecting = pages.switchTo('page', { key: new Array(1) });
    const invalid = Object.defineProperty({}, 'id', {
      enumerable: true,
      get() {
        getters++;
        return 'one';
      },
    });
    await assert.rejects(pages.switchTo('page', { key: invalid }), TypeError);
    assert.equal(getters, 0, 'selection must not invoke key accessors');
    work.resolve();
    assert.equal(await selecting, page, 'invalid input must not supersede valid pending selection');
    await pages.switchTo('page', { key: [undefined] });
    assert.equal(starts, 2, 'a hole must differ from explicit undefined');
    assert.equal(pages.getCurrent(), page);
  } finally {
    work.resolve();
    pages.destroy();
  }
});
