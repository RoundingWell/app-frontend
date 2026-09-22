// Keep coverage collection in the plugin; defer only its report task in headless runs.
export function deferCoverageReport(on, config) {
  // isInteractive can still be true during headless setup; isTextTerminal identifies run mode.
  return (event, handlers) => {
    if (event !== 'task') return on(event, handlers);

    if (config.testingType === 'component' && handlers.combineCoverage) {
      const combineCoverage = handlers.combineCoverage;
      handlers = {
        ...handlers,
        combineCoverage(sentCoverage) {
          const coverage = JSON.parse(sentCoverage);
          for (const path of Object.keys(coverage)) {
            if (/(?:^|\/)src\/js\/(?:apps|entities-service|services)\//.test(path.replaceAll('\\', '/'))) {
              delete coverage[path];
            }
          }
          return combineCoverage(JSON.stringify(coverage));
        },
      };
    }

    if (!config.isTextTerminal) return on(event, handlers);

    const report = handlers.coverageReport;
    on('task', { ...handlers, coverageReport: () => null });
    on('after:run', () => report());
  };
}
