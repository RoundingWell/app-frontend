import hexToRgb from '../plugins/hex-to-rgb.js';

export default (property, token) => $element => {
  const element = $element[0];
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  const color = style.getPropertyValue(token).trim();

  expect($element).to.have.css(property, hexToRgb({ color }).color);
};
