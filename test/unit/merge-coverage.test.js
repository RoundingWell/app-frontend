import path from 'path';

import { describe, expect, it } from 'vitest';

import { mergeCoverage, normalizeCoveragePaths } from './merge-coverage.mjs';

const cliniciansPath = path.resolve('src/js/entities-service/entities/clinicians.js');

describe('mergeCoverage', () => {
  it('supplements matching non-owned branches with unit coverage hits', () => {
    const cypressCoverage = {
      [cliniciansPath]: {
        statementMap: {},
        fnMap: {},
        branchMap: {
          0: {
            line: 30,
            type: 'default-arg',
            locations: [{ start: { line: 30, column: 27 }, end: { line: 30, column: 39 } }],
          },
        },
        s: {},
        f: {},
        b: { 0: [0] },
      },
    };
    const unitCoverage = {
      [cliniciansPath]: {
        statementMap: {},
        fnMap: {},
        branchMap: {
          7: {
            line: 30,
            type: 'default-arg',
            locations: [{ start: { line: 30, column: 27 }, end: { line: 30, column: 39 } }],
          },
        },
        s: {},
        f: {},
        b: { 7: [1] },
      },
    };

    const merged = mergeCoverage(cypressCoverage, unitCoverage);

    expect(merged[cliniciansPath].b[0]).toEqual([1]);
  });

  it('matches branches when the unit map omits the top-level line field', () => {
    const cypressCoverage = {
      [cliniciansPath]: {
        statementMap: {},
        fnMap: {},
        branchMap: {
          0: {
            line: 30,
            loc: { start: { line: 30, column: 18 }, end: { line: 30, column: 30 } },
            type: 'default-arg',
            locations: [{ start: { line: 30, column: 28 }, end: { line: 30, column: 30 } }],
          },
        },
        s: {},
        f: {},
        b: { 0: [0] },
      },
    };
    const unitCoverage = {
      [cliniciansPath]: {
        statementMap: {},
        fnMap: {},
        branchMap: {
          7: {
            loc: { start: { line: 30, column: 18 }, end: { line: 30, column: 30 } },
            type: 'default-arg',
            locations: [{ start: { line: 30, column: 28 }, end: { line: 30, column: 30 } }],
          },
        },
        s: {},
        f: {},
        b: { 7: [1] },
      },
    };

    const merged = mergeCoverage(cypressCoverage, unitCoverage);

    expect(merged[cliniciansPath].b[0]).toEqual([1]);
  });
});

describe('normalizeCoveragePaths', () => {
  it('rewrites absolute paths from a different prefix to use the current cwd', () => {
    const foreignPrefix = '/root/project';
    const foreignPath = `${ foreignPrefix }/src/js/app.js`;
    const coverage = {
      [foreignPath]: {
        path: foreignPath,
        statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        s: { 0: 1 },
      },
    };

    const normalized = normalizeCoveragePaths(coverage);
    const expectedPath = path.resolve('src/js/app.js');

    expect(Object.keys(normalized)).toEqual([expectedPath]);
    expect(normalized[expectedPath].path).toBe(expectedPath);
    expect(normalized[expectedPath].s[0]).toBe(1);
  });

  it('normalizes both coverage sets to the same keys for merging', () => {
    const cypressCoverage = {
      '/root/project/src/js/app.js': {
        statementMap: {},
        fnMap: {},
        branchMap: {
          0: {
            line: 10,
            type: 'if',
            locations: [{ start: { line: 10, column: 4 }, end: { line: 12, column: 5 } }],
          },
        },
        s: {},
        f: {},
        b: { 0: [0] },
      },
    };
    const unitCoverage = {
      '/home/circleci/project/src/js/app.js': {
        statementMap: {},
        fnMap: {},
        branchMap: {
          3: {
            line: 10,
            type: 'if',
            locations: [{ start: { line: 10, column: 4 }, end: { line: 12, column: 5 } }],
          },
        },
        s: {},
        f: {},
        b: { 3: [1] },
      },
    };

    const normalizedCypress = normalizeCoveragePaths(cypressCoverage);
    const normalizedUnit = normalizeCoveragePaths(unitCoverage);
    const merged = mergeCoverage(normalizedCypress, normalizedUnit);

    const expectedPath = path.resolve('src/js/app.js');
    expect(merged[expectedPath].b[0]).toEqual([1]);
  });
});
