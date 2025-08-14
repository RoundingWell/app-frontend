// takes a search string and builds a search for each word without the match tag
import { map, memoize } from 'underscore';

import words from 'js/utils/formatting/words';
import searchSanitize from 'js/utils/formatting/search-sanitize';

export default memoize(function(query) {
  const searchWords = map(words(searchSanitize(query)), RegExp.escape);

  return new RegExp(searchWords.join('|'), 'gi');
});
