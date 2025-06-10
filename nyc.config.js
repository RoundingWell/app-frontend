import { COVER_INCLUDE, COVER_EXCLUDE } from './config/coverage.js';

export default {
  'temp-dir': './coverage',
  'report-dir': './coverage',
  'include': COVER_INCLUDE,
  'exclude': COVER_EXCLUDE,
  'extension': ['.js'],
};
