// Keep coverage collection in the plugin; defer only its report task in headless runs.
export function deferCoverageReport(on, config) {
  // isInteractive can still be true during headless setup; isTextTerminal identifies run mode.
  return (event, handlers) => {
    if (event !== 'task' || !config.isTextTerminal) return on(event, handlers);

    const report = handlers.coverageReport;
    on('task', { ...handlers, coverageReport: () => null });
    on('after:run', () => report());
  };
}
