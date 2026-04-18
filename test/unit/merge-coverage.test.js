import path from 'path';

import { describe, expect, it } from 'vitest';

import { mergeCoverage } from './merge-coverage.mjs';

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

  it('supplements matching non-owned statements with unit coverage hits', () => {
    const cypressCoverage = {
      [cliniciansPath]: {
        statementMap: {
          0: { start: { line: 5, column: 0 }, end: { line: 5, column: 20 } },
          1: { start: { line: 10, column: 0 }, end: { line: 10, column: 30 } },
        },
        fnMap: {},
        branchMap: {},
        s: { 0: 1, 1: 0 },
        f: {},
        b: {},
      },
    };
    const unitCoverage = {
      [cliniciansPath]: {
        statementMap: {
          5: { start: { line: 10, column: 0 }, end: { line: 10, column: 30 } },
        },
        fnMap: {},
        branchMap: {},
        s: { 5: 3 },
        f: {},
        b: {},
      },
    };

    const merged = mergeCoverage(cypressCoverage, unitCoverage);

    expect(merged[cliniciansPath].s[0]).toBe(1);
    expect(merged[cliniciansPath].s[1]).toBe(3);
  });

  it('supplements matching non-owned functions with unit coverage hits', () => {
    const cypressCoverage = {
      [cliniciansPath]: {
        statementMap: {},
        fnMap: {
          0: { name: 'validate', decl: { start: { line: 20, column: 2 }, end: { line: 20, column: 10 } }, loc: { start: { line: 20, column: 2 }, end: { line: 25, column: 3 } } },
        },
        branchMap: {},
        s: {},
        f: { 0: 0 },
        b: {},
      },
    };
    const unitCoverage = {
      [cliniciansPath]: {
        statementMap: {},
        fnMap: {
          4: { name: 'validate', decl: { start: { line: 20, column: 2 }, end: { line: 20, column: 10 } }, loc: { start: { line: 20, column: 2 }, end: { line: 25, column: 3 } } },
        },
        branchMap: {},
        s: {},
        f: { 4: 2 },
        b: {},
      },
    };

    const merged = mergeCoverage(cypressCoverage, unitCoverage);

    expect(merged[cliniciansPath].f[0]).toBe(2);
  });
});
