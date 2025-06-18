import trim from 'js/utils/formatting/trim';

export default str => {
  str = String(str);

  // dashes to spaces
  str = str.replace(/-/g, ' ');

  // all non alphanumeric characters are removed
  str = str.replace(/[^\w\s]/g, '');

  return trim(str).toLowerCase();
};
