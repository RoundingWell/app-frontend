import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import bindings from '../test/support/messaging-bindings.js';
import { loadMessagingBindings } from './messaging-prototype-bindings.js';

for (const field of ['hostname', 'workspaceId']) {
  test(`rejects a non-string ${ field } rather than coercing it`, t => {
    const directory = mkdtempSync(join(tmpdir(), 'messaging-bindings-'));
    t.after(() => rmSync(directory, { recursive: true }));
    const filename = join(directory, 'bindings.json');
    writeFileSync(filename, JSON.stringify({ ...bindings, [field]: [bindings[field]] }));
    assert.throws(() => loadMessagingBindings(filename), /Messaging prototype bindings require/);
    writeFileSync(filename, JSON.stringify(bindings));
    assert.deepEqual(loadMessagingBindings(filename), bindings);
  });
}
