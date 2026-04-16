import { describe, it, expect } from 'vitest';
import Backbone from 'backbone';

import {
  alphaSort,
  intSortBy,
  numSortBy,
  numSort,
} from 'js/utils/sorting';

const sortsFixture = [
  {
    alpha: 'a',
    num: 1.1,
    int: 1,
    order: 1,
  },
  {
    alpha: 'c',
    num: 3.1,
    int: 3,
    order: 3,
  },
  {
    alpha: 'b',
    num: 2.1,
    int: 2,
    order: 2,
  },
  {
    order: 0,
  },
];

const SortCollection = Backbone.Collection.extend({
  getOrder() {
    return this.map('order').join();
  },
});

function testSort(getComparator) {
  const sortCollection = new SortCollection(sortsFixture);

  sortCollection.comparator = getComparator('asc');
  sortCollection.sort();
  expect(sortCollection.getOrder()).toBe('0,1,2,3');

  sortCollection.comparator = getComparator('desc');
  sortCollection.sort();
  expect(sortCollection.getOrder()).toBe('3,2,1,0');
}

describe('sorting', () => {
  it('alphaSort', () => {
    testSort(sortDir => {
      return (modelA, modelB) => {
        return alphaSort(sortDir, modelA.get('alpha'), modelB.get('alpha'));
      };
    });
  });

  it('intSortBy', () => {
    testSort(sortDir => model => intSortBy(sortDir, model.get('int')));
  });

  it('numSort', () => {
    testSort(sortDir => {
      return (modelA, modelB) => {
        return numSort(sortDir, modelA.get('num'), modelB.get('num'));
      };
    });
  });

  it('numSortBy', () => {
    testSort(sortDir => model => numSortBy(sortDir, model.get('num')));
  });

  it('handles missing alpha values with the provided null fallback', () => {
    expect(alphaSort('asc', null, 'beta', 'zzz')).toBeGreaterThan(0);
    expect(alphaSort('desc', undefined, 'beta', 'aaa')).toBeGreaterThan(0);
  });

  it('uses the provided default values for number sorting helpers', () => {
    expect(intSortBy('asc', undefined, '12')).toBe(12);
    expect(intSortBy('desc', undefined, '12')).toBe(-12);

    expect(numSortBy('asc', null, 9)).toBe(9);
    expect(numSortBy('desc', null, 9)).toBe(-9);
  });

  it('uses null values when comparing numbers directly', () => {
    expect(numSort('asc', null, 3, 0)).toBe(-1);
    expect(numSort('desc', 5, null, 0)).toBe(-1);
  });
});
