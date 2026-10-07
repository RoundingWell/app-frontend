const nyc = require('../.nycrc.json');

const COVER_INCLUDE = nyc.include;
const COVER_EXCLUDE = nyc.exclude;

// Keep unloaded-file inventory maps identical to Vite's source instrumentation.
function coverageBabelOptions({ cwd, onCover, config = nyc } = {}) {
  return {
    babelrc: false,
    configFile: false,
    plugins: [
      [require.resolve('babel-plugin-istanbul'), {
        include: config.include,
        exclude: config.exclude,
        ...(cwd && { cwd }),
        ...(onCover && { onCover }),
      }],
    ],
  };
}

module.exports = { COVER_INCLUDE, COVER_EXCLUDE, coverageBabelOptions };
