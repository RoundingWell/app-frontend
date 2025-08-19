// finds results from a query string within the text passed
// and wraps it in the pretag posttag.  Defaulting to <strong></strong>

import buildMatcher from 'js/utils/formatting/build-matcher';
import buildMatcherSubstrings from 'js/utils/formatting/build-matcher-substrings';

export default (text, query, options = {}) => {
  if (!text) return;

  const pretag = options.pretag || 'strong';
  const posttag = options.posttag || pretag;
  const includeSubstrings = !!options.includeSubstrings;

  const matcher = includeSubstrings ? buildMatcherSubstrings(query) : buildMatcher(query);

  return text.replace(matcher, `<${ pretag }>$&</${ posttag }>`);
};
