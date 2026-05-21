import camelCase from 'lodash.camelcase';
import { icon, config } from '@fortawesome/fontawesome-svg-core';
import * as fasIcons from '@fortawesome/pro-solid-svg-icons';
import * as farIcons from '@fortawesome/pro-regular-svg-icons';
import * as falIcons from '@fortawesome/pro-light-svg-icons';
import * as fatIcons from '@fortawesome/pro-thin-svg-icons';

config.replacementClass = '';

function getIconHtml(lib, fonts) {
  return fonts.map(iconClass => {
    const iconName = camelCase(`fa-${ iconClass }`);
    /* eslint-disable-next-line no-console */
    if (!lib[iconName]) console.error('Missing icon:', iconName);
    return icon(lib[iconName], { symbol: true }).html.map(h => h.replace('<symbol ', '<symbol overflow="visible" '));
  });
}

export default ({ fas = [], far = [], fal = [], fat = [] } = {}) => {
  return [
    ...getIconHtml(fasIcons, fas),
    ...getIconHtml(farIcons, far),
    ...getIconHtml(falIcons, fal),
    ...getIconHtml(fatIcons, fat),
  ].join('');
};
