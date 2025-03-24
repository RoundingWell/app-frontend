import { map } from 'underscore';

import words from 'js/utils/formatting/words';
import searchSanitize from 'js/utils/formatting/search-sanitize';

export default query => {
  const searchWords = map(words(searchSanitize(query)), RegExp.escape);

  return map(searchWords, function(word) {
    return new RegExp(`\\b${ word }`, 'i');
  });
};
