import globals from 'globals';
import js from '@eslint/js';
import mocha from 'eslint-plugin-mocha';
import chaiFriendly from 'eslint-plugin-chai-friendly';
import cypress from 'eslint-plugin-cypress';
import stylistic from '@stylistic/eslint-plugin';

const TEST_FILES = [
  'test/**',
  '**/*.cy.js',
];

export default [
  js.configs.recommended,
  {
    name: 'Base globals & quality rules',
    languageOptions: {
      ecmaVersion: 'latest',
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
      'arrow-body-style': 'off',
      'complexity': ['error', 8],
      'curly': ['error', 'multi-line'],
      'dot-notation': 'error',
      'eqeqeq': ['error', 'allow-null'],
      'no-alert': 'error',
      'no-bitwise': 'error',
      'no-caller': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-console': 'warn',
      'no-debugger': 'warn',
      'no-duplicate-imports': 'error',
      'no-else-return': 'error',
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-lone-blocks': 'error',
      'no-multi-str': 'error',
      'no-new-wrappers': 'error',
      'no-return-assign': 'error',
      'no-script-url': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-shadow': 'error',
      'no-undef-init': 'error',
      'no-unneeded-ternary': 'error',
      'no-unused-vars': ['error', { args: 'none' }],
      'no-useless-concat': 'error',
      'no-var': 'error',
      'one-var': ['error', 'never'],
      'prefer-const': 'error',
      'prefer-template': 'error',
      'radix': ['error', 'always'],
    },
  },
  stylistic.configs.recommended,
  {
    name: 'Stylistic overrides',
    rules: {
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/computed-property-spacing': ['error', 'never'],
      '@stylistic/dot-location': ['error', 'property'],
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/operator-linebreak': [
        'error',
        'before',
        {
          overrides: {
            '?': 'after',
            ':': 'after',
          },
        },
      ],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/quote-props': ['error', 'consistent'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/semi-spacing': ['error', { before: false, after: true }],
      '@stylistic/space-before-function-paren': ['error', 'never'],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/spaced-comment': ['error', 'always'],
      '@stylistic/template-curly-spacing': ['error', 'always'],
      '@stylistic/wrap-iife': ['error', 'inside'],
    },
  },
  {
    files: TEST_FILES,
    ...mocha.configs.recommended,
  },
  {
    name: 'Mocha overrides',
    files: TEST_FILES,
    rules: {
      'mocha/no-mocha-arrows': 'off',
      'mocha/no-setup-in-describe': 'off',
      'mocha/no-pending-tests': 'error',
    },
  },
  {
    files: TEST_FILES,
    ...chaiFriendly.configs.recommendedFlat,
  },
  {
    files: TEST_FILES,
    ...cypress.configs.recommended,
  },
  {
    name: 'Cypress overrides',
    files: TEST_FILES,
    rules: {
      'cypress/no-unnecessary-waiting': 'off',
      'cypress/unsafe-to-chain-command': 'off',
    },
  },
  {
    ignores: [
      'public/**',
      'dist/**',
      'coverage/**',
      'packages/**/sdk/**',
    ],
  },
];
