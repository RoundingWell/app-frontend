import globals from 'globals';
import js from '@eslint/js';
import mocha from 'eslint-plugin-mocha';
import cypress from 'eslint-plugin-cypress';
import chaiFriendly from 'eslint-plugin-chai-friendly';
import stylistic from '@stylistic/eslint-plugin';

/* ───────── Stylistic customisation ───────── */
const stylisticRules = stylistic.configs.customize({
  semi: true,
  templateCurlySpacing: 'always',
  arrowParens: 'as-needed',
});

/* ───────── Test presets pulled separately ───────── */
const mochaPreset = mocha.configs.recommended;
const cypressPreset = cypress.configs.recommended;
const chaiPreset = chaiFriendly.configs.recommendedFlat;

/* Hand-merged (explicit) composite for tests */
const testPreset = {
  plugins: {
    ...mochaPreset.plugins,
    ...cypressPreset.plugins,
    ...chaiPreset.plugins,
  },
  rules: {
    ...mochaPreset.rules,
    ...cypressPreset.rules,
    ...chaiPreset.rules,
  },
  languageOptions: {
    ...mochaPreset.languageOptions,
    ...cypressPreset.languageOptions,
    ...chaiPreset.languageOptions,
    globals: {
      ...mochaPreset.languageOptions?.globals,
      ...cypressPreset.languageOptions?.globals,
      ...chaiPreset.languageOptions?.globals,
    },
  },
};

export default [
  /* ─────────────────── Base (all files) ─────────────────── */
  js.configs.recommended,
  {
    name: 'General',
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        _PRODUCTION_: 'readonly',
        _DEVELOP_: 'readonly',
        _TEST_: 'readonly',
        _NOW_: 'readonly',
      },
    },
    rules: {
      ...stylisticRules.rules,
      'complexity': ['error', 8],
      'radix': ['error', 'always'],
      'no-console': 'warn',
      'no-unused-vars': ['error', { args: 'none' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
    },
  },

  /* ─────────────────── Test-only overrides ─────────────────── */
  {
    name: 'Tests: presets',
    files: ['test/**', '**/*.cy.js'],
    ...testPreset,
  },
  {
    name: 'Tests: local tweaks',
    files: ['test/**', '**/*.cy.js'],
    rules: {
      'cypress/no-unnecessary-waiting': 'off',
      'cypress/unsafe-to-chain-command': 'off',
      'mocha/no-setup-in-describe': 'off',
      'no-console': 'warn',
      'no-debugger': 'warn',
    },
  },
];
