/**
 * Shared driver conformance suite. Runs under node:test and in a browser
 * (Cypress/Mocha): the runner is injected, so this module imports nothing.
 *
 * Every navigation the suite performs is intercepted by a listener it
 * registers, so a real Navigation API stays same-document.
 *
 * @param {object} config
 * @param {string} config.name Suite label.
 * @param {() => ({ driver: object, dispose?: () => void } | Promise<{ driver: object, dispose?: () => void }>)} config.createDriver
 *   Fresh driver per test; `dispose` runs after each test.
 * @param {Function} config.describe
 * @param {Function} config.it
 * @param {object} config.assert Chai-style `assert` (ok, equal, deepEqual, …).
 */
export function driverConformance({ name, createDriver, describe, it, assert }) {
  throw new Error('Not implemented');
}
