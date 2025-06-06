// files you want coverage for
export const COVER_INCLUDE = ['src/js/**/*.js'];

// files to skip (helpers, entry points, etc.)
export const COVER_EXCLUDE = [
  'src/**/*.cy.js',
  'src/js/base/**',
  'src/js/auth/**',
  'src/js/formapp/**',
  'src/js/index.js',
  'src/js/datadog.js',
  'src/js/config.js',
];
