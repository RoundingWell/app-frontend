const COVERAGE_STORE_KEY = '__coverage__';

function resetCounts(counterMap = {}) {
  for (const key of Object.keys(counterMap)) {
    counterMap[key] = 0;
  }
}

function resetBranchCounts(branchMap = {}) {
  for (const key of Object.keys(branchMap)) {
    branchMap[key] = (branchMap[key] || []).map(() => 0);
  }
}

function resetCoverageFile(fileCoverage) {
  resetCounts(fileCoverage.s);
  resetCounts(fileCoverage.f);
  resetBranchCounts(fileCoverage.b);
}

function resetCoverageMap(coverageMap) {
  if (!coverageMap) return;

  for (const fileCoverage of Object.values(coverageMap)) {
    resetCoverageFile(fileCoverage);
  }
}

const mod = {
  startCoverage() {
    resetCoverageMap(globalThis[COVERAGE_STORE_KEY]);
  },

  takeCoverage() {
    const coverage = globalThis[COVERAGE_STORE_KEY];

    globalThis[COVERAGE_STORE_KEY] = undefined;

    return coverage;
  },

  async getProvider() {
    const { VitestBabelCoverageProvider } = await import('./provider.js');

    return new VitestBabelCoverageProvider();
  },
};

export default mod;
