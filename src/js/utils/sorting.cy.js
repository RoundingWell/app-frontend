// NOTE: these unit tests are intentionally using Backbone.Collection
// to facilitate the sorting as that integration is a first-class concern

import Backbone from 'backbone';

import {
  alphaSort,
  intSortBy,
  numSortBy,
  numSort,
} from './sorting';

const sorts_fx = [
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
  const sortCol = new SortCollection(sorts_fx);

  sortCol.comparator = getComparator('asc');
  sortCol.sort();
  expect(sortCol.getOrder(), 'asc').to.equal('0,1,2,3');

  sortCol.comparator = getComparator('desc');
  sortCol.sort();
  expect(sortCol.getOrder(), 'desc').to.equal('3,2,1,0');
}

context('sorting', function() {
  specify('alphaSort', function() {
    testSort(sortDir => {
      return function(modelA, modelB) {
        const valA = modelA.get('alpha');
        const valB = modelB.get('alpha');
        return alphaSort(sortDir, valA, valB);
      };
    });
  });

  specify('intSortBy', function() {
    testSort(sortDir => {
      return function(model) {
        return intSortBy(sortDir, model.get('int'));
      };
    });
  });

  specify('numSort', function() {
    testSort(sortDir => {
      return function(modelA, modelB) {
        const valA = modelA.get('num');
        const valB = modelB.get('num');
        return numSort(sortDir, valA, valB);
      };
    });
  });

  specify('numSortBy', function() {
    testSort(sortDir => {
      return function(model) {
        return numSortBy(sortDir, model.get('num'));
      };
    });
  });

  specify('handles missing alpha values with the provided null fallback', function() {
    expect(alphaSort('asc', null, 'beta', 'zzz')).to.be.greaterThan(0);
    expect(alphaSort('desc', undefined, 'beta', 'aaa')).to.be.greaterThan(0);
  });

  specify('uses the provided default values for number sorting helpers', function() {
    expect(intSortBy('asc', undefined, '12')).to.equal(12);
    expect(intSortBy('desc', undefined, '12')).to.equal(-12);

    expect(numSortBy('asc', null, 9)).to.equal(9);
    expect(numSortBy('desc', null, 9)).to.equal(-9);
  });

  specify('uses null values when comparing numbers directly', function() {
    expect(numSort('asc', null, 3, 0)).to.equal(-1);
    expect(numSort('desc', 5, null, 0)).to.equal(-1);
  });
});
