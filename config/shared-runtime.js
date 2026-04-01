const SHARED_RUNTIME_ENTRIES = Object.freeze({
  '@roundingwell/care-ops-config': {
    publicPath: '/shared/config.js',
    sourcePath: '/packages/care-ops-config/index.js',
    entry: 'packages/care-ops-config/index.js',
    fileName: 'config.js',
  },
  '@roundingwell/care-ops-datadog': {
    publicPath: '/shared/datadog.js',
    sourcePath: '/packages/care-ops-datadog/index.js',
    entry: 'packages/care-ops-datadog/index.js',
    fileName: 'datadog.js',
  },
  '@roundingwell/care-ops-forms': {
    publicPath: '/shared/forms.js',
    sourcePath: '/packages/care-ops-forms/index.js',
    entry: 'packages/care-ops-forms/index.js',
    fileName: 'forms.js',
  },
});

const ROOT_SHARED_RUNTIME_MODULE_IDS = Object.freeze([
  '@roundingwell/care-ops-config',
  '@roundingwell/care-ops-datadog',
]);

const ROOT_SHARED_RUNTIME_MODULES = Object.freeze(Object.fromEntries(
  ROOT_SHARED_RUNTIME_MODULE_IDS.map(moduleId => {
    return [moduleId, SHARED_RUNTIME_ENTRIES[moduleId].publicPath];
  }),
));

const SHARED_RUNTIME_DEV_MODULES = Object.freeze(Object.fromEntries(
  Object.values(SHARED_RUNTIME_ENTRIES).map(({ publicPath, sourcePath }) => [publicPath, sourcePath]),
));

const SHARED_RUNTIME_BUILD_CONFIGS = Object.freeze({
  'shared-config': {
    entry: SHARED_RUNTIME_ENTRIES['@roundingwell/care-ops-config'].entry,
    fileName: SHARED_RUNTIME_ENTRIES['@roundingwell/care-ops-config'].fileName,
  },
  'shared-datadog': {
    entry: SHARED_RUNTIME_ENTRIES['@roundingwell/care-ops-datadog'].entry,
    fileName: SHARED_RUNTIME_ENTRIES['@roundingwell/care-ops-datadog'].fileName,
  },
  'shared-forms': {
    entry: SHARED_RUNTIME_ENTRIES['@roundingwell/care-ops-forms'].entry,
    fileName: SHARED_RUNTIME_ENTRIES['@roundingwell/care-ops-forms'].fileName,
    externalModules: ROOT_SHARED_RUNTIME_MODULE_IDS,
    paths: ROOT_SHARED_RUNTIME_MODULES,
  },
});

export {
  ROOT_SHARED_RUNTIME_MODULE_IDS,
  ROOT_SHARED_RUNTIME_MODULES,
  SHARED_RUNTIME_BUILD_CONFIGS,
  SHARED_RUNTIME_DEV_MODULES,
};
