import fs from 'fs/promises';
import path from 'path';

import libCoverage from 'istanbul-lib-coverage';
import { BaseCoverageProvider } from 'vitest/node';
import vitestPackage from 'vitest/package.json' with { type: 'json' };
import { normalizeCoverageMap } from '../normalize-coverage-map.mjs';

export class VitestBabelCoverageProvider extends BaseCoverageProvider {
  name = 'custom';
  version = vitestPackage.version;

  initialize(ctx) {
    this._initialize(ctx);
  }

  createCoverageMap() {
    return libCoverage.createCoverageMap({});
  }

  async generateCoverage() {
    const coverageMap = this.createCoverageMap();

    await this.readCoverageFiles({
      onFileRead(coverage) {
        coverageMap.merge(coverage || {});
      },
      async onFinished() {},
      onDebug: Object.assign(() => {}, { enabled: false }),
    });

    return coverageMap;
  }

  async generateReports(coverageMap) {
    await fs.mkdir(this.options.reportsDirectory, { recursive: true });

    const reportPath = path.join(this.options.reportsDirectory, 'coverage-final.json');
    const normalizedCoverage = normalizeCoverageMap(coverageMap.toJSON());

    await fs.writeFile(reportPath, JSON.stringify(normalizedCoverage));
  }
}
