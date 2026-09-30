import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();
const specPath = 'src/js/example.e2e.cy.js';

async function lint(code, filePath = specPath) {
  const [result] = await eslint.lintText(code, { filePath });

  return result.messages;
}

test('Cypress command layout fixes standalone chains and preserves comments', async() => {
  const fixer = new ESLint({ fix: true });
  const code = 'cy.get(\'.list\') /* scoped */ .find(\'.item\').should(\'be.visible\');\n';
  const [result] = await fixer.lintText(code, { filePath: specPath });

  assert.deepEqual(result.messages, []);
  assert.equal(result.output, 'cy\n  .get(\'.list\') /* scoped */\n  .find(\'.item\')\n  .should(\'be.visible\');\n');
});

test('command layout preserves standalone commands and assigned stubs', async() => {
  const code = 'cy.tick(1000);\nconst reported = cy.stub().as(\'reported\');\ncy.wrap(reported);\n';

  assert.deepEqual(await lint(code), []);
});

test('command layout leaves other fluent APIs alone', async() => {
  assert.deepEqual(await lint('const values = [1].map(value => value + 1).filter(Boolean);\ncy.wrap(values);\n'), []);
});

test('command layout handles callbacks and multiline arguments', async() => {
  const code = 'cy.get(\'.list\').then($list => {\n  cy.wrap($list).should(\'be.visible\');\n});\n';
  const messages = await lint(code);

  assert.equal(messages.length, 4);
  assert.ok(messages.every(message => message.ruleId === 'local/cypress-command-layout'));
});

test('specs require Cypress.Promise and reject empty statements', async() => {
  const messages = await lint('new Promise(resolve => resolve());\n;\n');

  assert.deepEqual(messages.map(message => message.ruleId).sort(), [
    '@stylistic/no-extra-semi',
    'no-restricted-syntax',
  ]);
  assert.deepEqual(await lint('new Cypress.Promise(resolve => resolve());\n'), []);
});

test('spec rules cover component specs and leave runtime and helpers alone', async() => {
  const code = 'cy.get(\'.list\').find(\'.item\');\nnew Promise(resolve => resolve());\n';
  const messages = await lint(code, 'src/js/example.component.cy.js');

  assert.equal(messages.filter(message => message.ruleId === 'local/cypress-command-layout').length, 2);
  assert.ok(messages.some(message => message.ruleId === 'no-restricted-syntax'));
  assert.deepEqual(await lint('new Promise(resolve => resolve());\n', 'src/js/example.js'), []);
  assert.deepEqual(await lint('new Promise(resolve => resolve());\n', 'test/support/example.js'), []);
});
