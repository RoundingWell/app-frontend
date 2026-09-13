import $ from 'jquery';
import _, { extend } from 'underscore';
import Backbone from 'backbone';
import dayjs from 'dayjs';
import Radio from 'backbone.radio';
import BackboneApi from '@mnjs/adapters/backbone';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';
import MorphdomDomApi from '@mnjs/adapters/dom/morphdom';
import * as Marionette from 'marionette';
import './backbone-fetch';
import './dayjs';
import './fontawesome';
import './helpers';
import './hotkeys';
import './uuid';

const { View, CollectionView, setDataApi, setDomApi, setStateApi } = Marionette;

setDataApi(BackboneApi);
setStateApi(BackboneApi);
setDomApi(JQueryDomApi);
setDomApi(MorphdomDomApi);

/* istanbul ignore if */
if (_DEVELOP_) {
  Radio.DEBUG = true;
}

// Expose libraries for the console
window._ = _;
window.$ = $;
window.Backbone = Backbone;
window.Radio = Radio;
window.Marionette = Marionette;
window.dayjs = dayjs;

const getBounds = function(ui) {
  /* istanbul ignore if */
  if (!this.isAttached()) {
    return false;
  }

  // Allow for the user to get the bounds of a different ui elem
  const el = ui || this.el;
  const { left, top } = el.getBoundingClientRect();
  const { scrollX, scrollY } = el.ownerDocument.defaultView;

  return {
    left: left + scrollX,
    top: top + scrollY,
    outerHeight: el.offsetHeight,
    outerWidth: el.offsetWidth,
  };
};

extend(View.prototype, {
  getBounds,
});

extend(CollectionView.prototype, {
  getBounds,
});

Backbone.Model.prototype.dayjs = function(attr) {
  const date = this.get(attr);

  // return '', null or undefined explicitly
  if (!date && date !== 0) {
    return date;
  }

  return dayjs(date);
};

// For use of escaping a string for within a regex
// http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex#6969486
RegExp.escape = function(str) {
  return str.replace(/[\\^$.*+?()[\]{}|-]/g, '\\$&');
};
