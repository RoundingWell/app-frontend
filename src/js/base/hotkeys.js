// Adapted from https://github.com/jeresig/jquery.hotkeys

import $ from 'jquery';
import { contains, each, isString } from 'underscore';

const specialKeys = {
  8: 'backspace', 9: 'tab', 10: 'return', 13: 'return', 16: 'shift', 17: 'ctrl', 18: 'alt',
  19: 'pause', 20: 'capslock', 27: 'esc', 32: 'space', 33: 'pageup', 34: 'pagedown', 35: 'end',
  36: 'home', 37: 'left', 38: 'up', 39: 'right', 40: 'down', 45: 'insert', 46: 'del', 59: ';',
  61: '=', 96: '0', 97: '1', 98: '2', 99: '3', 100: '4', 101: '5', 102: '6', 103: '7', 104: '8',
  105: '9', 106: '*', 107: '+', 109: '-', 110: '.', 111: '/', 112: 'f1', 113: 'f2', 114: 'f3',
  115: 'f4', 116: 'f5', 117: 'f6', 118: 'f7', 119: 'f8', 120: 'f9', 121: 'f10', 122: 'f11', 123: 'f12',
  144: 'numlock', 145: 'scroll', 173: '-', 186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/',
  192: '`', 219: '[', 220: '\\', 221: ']', 222: '\'',
};

const shiftNums = {
  '`': '~', '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(',
  '0': ')', '-': '_', '=': '+', ';': ': ', '\'': '\'', ',': '<', '.': '>', '/': '?', '\\': '|',
};

// excludes: button, checkbox, file, hidden, image, password, radio, reset, search, submit, url
const textAcceptingInputTypes = [
  'text', 'password', 'number', 'email', 'url', 'range', 'date', 'month', 'week', 'time', 'datetime',
  'datetime-local', 'search', 'color', 'tel',
];

// default input types not to bind to unless bound directly
const textInputTypes = /textarea|input|select/i;

$.hotkeys = {
  version: '1.0.0',

  isTargetInput(target) {
    return textInputTypes.test(target.nodeName)
      || $(target).attr('contenteditable')
      || contains(textAcceptingInputTypes, target.type);
  },
};

function getKeys({ data }) {
  if (isString(data)) return data.toLowerCase().split(' ');
  if (data && isString(data.keys)) return data.keys.toLowerCase().split(' ');
}

function getModifier(event, special) {
  let modif = '';

  each(['alt', 'ctrl', 'shift'], function(specialKey) {
    if (event[`${ specialKey }Key`] && special !== specialKey) {
      modif += `${ specialKey }+`;
    }
  });

  // metaKey is triggered off ctrlKey erronously
  if (event.metaKey && !event.ctrlKey && special !== 'meta') {
    modif += 'meta+';
  }

  if (event.metaKey && special !== 'meta' && modif.indexOf('alt+ctrl+shift+') > -1) {
    modif = modif.replace('alt+ctrl+shift+', 'hyper+');
  }

  return modif;
}

function getPossibleKeys(event, special, character) {
  const possible = {};
  const modifier = getModifier(event, special);

  if (special) {
    possible[modifier + special] = true;
  } else {
    possible[modifier + character] = true;
    possible[modifier + shiftNums[character]] = true;

    // '$' can be triggered as 'Shift+4' or 'Shift+$' or just '$'
    if (modifier === 'shift+') {
      possible[shiftNums[character]] = true;
    }
  }

  return possible;
}

function keyHandler(handleObj) {
  const keys = getKeys(handleObj);

  // Only care when a possible input has been specified
  if (!keys) return;

  const origHandler = handleObj.handler;

  handleObj.handler = function(event) {
    // Don't fire in text-accepting inputs that we didn't directly bind to
    if (this !== event.target && $.hotkeys.isTargetInput(event.target)) return;

    const special = event.type !== 'keypress' && specialKeys[event.which];
    const character = String.fromCharCode(event.which).toLowerCase();
    const possible = getPossibleKeys(event, special, character);

    for (let i = 0, l = keys.length; i < l; i++) {
      if (possible[keys[i]]) {
        return origHandler.apply(this, arguments);
      }
    }
  };
}

each(['keydown', 'keyup', 'keypress'], event => {
  $.event.special[event] = {
    add: keyHandler,
  };
});
