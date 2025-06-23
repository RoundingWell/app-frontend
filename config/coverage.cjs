const nyc = require('../.nycrc.json');

const COVER_INCLUDE = nyc.include;
const COVER_EXCLUDE = nyc.exclude;

module.exports = { COVER_INCLUDE, COVER_EXCLUDE };
