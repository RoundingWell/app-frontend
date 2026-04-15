import { describe, it, expect } from 'vitest';

import buildMatcher from 'js/utils/formatting/build-matcher';
import buildMatcherSubstrings from 'js/utils/formatting/build-matcher-substrings';
import buildMatchersArray from 'js/utils/formatting/build-matchers-array';
import collectionOf from 'js/utils/formatting/collection-of';
import hasAllText from 'js/utils/formatting/has-all-text';
import matchText from 'js/utils/formatting/match-text';
import px from 'js/utils/formatting/px';
import removeNewline from 'js/utils/formatting/remove-newline';
import searchSanitize from 'js/utils/formatting/search-sanitize';
import startsWith from 'js/utils/formatting/starts-with';
import trim from 'js/utils/formatting/trim';
import underscored from 'js/utils/formatting/underscored';
import words from 'js/utils/formatting/words';

describe('formatting', () => {
  it('buildMatcher', () => {
    const matcher = buildMatcher('test string');
    expect(matcher).toEqual(/\btest|string/gi);
  });

  it('buildMatcher - include substrings', () => {
    const matcher = buildMatcherSubstrings('test string');
    expect(matcher).toEqual(/test|string/gi);
  });

  it('buildMatchersArray', () => {
    const matchersArray = buildMatchersArray('test string');
    expect(matchersArray).toEqual([/\btest/i, /\bstring/i]);
  });

  it('collectionOf', () => {
    expect(collectionOf([1, 2, 3], 'id')).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('hasAllText', () => {
    expect(hasAllText()).toBe(false);
    expect(hasAllText('This is a Test test', 'test')).toBe(true);
    expect(hasAllText('This is a Test test', 'nothere')).toBe(false);
    expect(hasAllText('This is a Test test', 'test nothere')).toBe(false);
  });

  it('matchText', () => {
    expect(matchText()).toBeUndefined();
    expect(matchText('This is a test', 'test')).toBe('This is a <strong>test</strong>');
    expect(matchText('This is a test', 'test', { pretag: 'p class="test"', posttag: 'p' })).toBe(
      'This is a <p class="test">test</p>',
    );
    expect(matchText('This is testing', 'test', { includeSubstrings: true })).toBe(
      'This is <strong>test</strong>ing',
    );
  });

  it('px', () => {
    expect(px(25.25)).toBe('25.25px');
  });

  it('removeNewline', () => {
    expect(removeNewline('text\rmore\ntext')).toBe('text more text');
  });

  it('searchSanitize', () => {
    expect(searchSanitize('   Hi@-World-')).toBe('hi world');
  });

  it('startsWith', () => {
    expect(startsWith()).toBeUndefined();
    expect(startsWith('care ops', 'care')).toBe(true);
    expect(startsWith('care ops', 'ops')).toBe(false);
    expect(startsWith(12345, 123)).toBe(true);
  });

  it('trim', () => {
    expect(trim()).toBe('');
    expect(trim(' trim ')).toBe('trim');
    expect(trim(':: trim::', ':')).toBe(' trim');
  });

  it('underscored', () => {
    expect(underscored()).toBeUndefined();
    expect(underscored('foo bar-baz')).toBe('foo_bar_baz');
  });

  it('words', () => {
    expect(words()).toHaveLength(0);
    expect(words('test this')).toEqual(['test', 'this']);
    expect(words('test:this', ':')).toEqual(['test', 'this']);
  });
});
