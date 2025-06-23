import $ from 'jquery';
import _, { extend } from 'underscore';
import Backbone from 'backbone';
import dayjs from 'dayjs';
import Radio from 'backbone.radio';
import * as Marionette from 'marionette';
import { Component } from 'marionette.toolkit';
import DomApi from './domapi';
import './backbone-fetch';
import './dayjs';
import './fontawesome';
import './helpers';
import './hotkeys';
import './uuid';

const { Region, View, CollectionView, setDomApi } = Marionette;

setDomApi(DomApi);

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

const regionShow = Region.prototype.show;

// Allow for components to be shown directly in regions
Region.prototype.show = function(view, options) {
  if (view instanceof Component) {
    view.showIn(this, null, options);

    return this;
  }

  return regionShow.call(this, view, options);
};

const getBounds = function(ui) {
  /* istanbul ignore if */
  if (!this.isAttached()) {
    return false;
  }

  // Allow for the user to get the bounds of a different ui elem
  const $el = ui || this.$el;

  const { left, top } = $el.offset();
  const outerHeight = $el.outerHeight();
  const outerWidth = $el.outerWidth();

  return { left, top, outerHeight, outerWidth };
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
