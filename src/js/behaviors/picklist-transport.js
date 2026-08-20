import { Behavior } from 'marionette';
import Radio from 'backbone.radio';

import keyCodes from 'js/utils/formatting/key-codes';

import KeyListenerBehavior from './key-listener';

const { ENTER_KEY, ESCAPE_KEY, DOWN_KEY, TAB_KEY, UP_KEY } = keyCodes;

export default Behavior.extend({
  behaviors: [
    {
      behaviorClass: KeyListenerBehavior,
      keyEvents: {
        'transport:down': DOWN_KEY,
        'transport:up': UP_KEY,
        'select': ENTER_KEY,
        'transport:close': [ESCAPE_KEY, TAB_KEY],
      },
    },
  ],

  options: {
    items: '.js-picklist-item',
    scroll: '.js-picklist-scroll',
  },

  events() {
    const evts = {};

    // by default 'mouseenter .js-picklist-item'
    evts[`mouseenter ${ this.getOption('items') }`] = this.onHoverItem;

    return evts;
  },

  // must be onAttach, so that the width of droplist is already set for scrolling calc
  onAttach() {
    const $items = this.getItems();
    this.scrollTo($items, $items.filter('.is-selected'), 'middle');
  },

  onHoverItem(evt) {
    this.updateTransport(this.getItems(), this.view.$(evt.currentTarget));
  },

  onTransportDown(evt) {
    evt.preventDefault();

    const $items = this.getItems();
    const $highlighted = this._getNextHighlighted($items);

    this.updateTransport($items, $highlighted);

    this.scrollTo($items);
  },

  onTransportUp(evt) {
    evt.preventDefault();

    const $items = this.getItems();
    const $highlighted = this._getPrevHighlighted($items);

    this.updateTransport($items, $highlighted);

    this.scrollTo($items);
  },
  onTransportClose(evt) {
    if (evt.which === ESCAPE_KEY) {
      evt.preventDefault();
      evt.stopImmediatePropagation();

      if (Radio.request('close-request', 'close:top')) return;
    }

    this.view.triggerMethod('close', {
      event: evt,
      reason: evt.which === TAB_KEY ? 'tab' : 'escape',
      reverse: evt.shiftKey,
    });
  },

  getItems() {
    return this.view.$(this.getOption('items'));
  },

  getHighlighted($items) {
    return $items.filter('.is-highlighted');
  },

  updateTransport($items, $highlighted) {
    $items.removeClass('is-highlighted');
    $highlighted.addClass('is-highlighted');
  },

  // determines based on what is highlighted (or not)
  // what the next highlighted item will be when arrow up is pushed
  _getPrevHighlighted($items) {
    const $highlighted = this.getHighlighted($items);

    /* istanbul ignore if: complicated generic test, but simple code */
    if (!$highlighted.length) {
      return $items.last();
    }

    const nextIndex = $items.index($highlighted) - 1;

    if (nextIndex < 0) {
      return $highlighted;
    }

    return $items.eq(nextIndex);
  },

  // determines based on what is highlighted (or not)
  // what the next highlighted item will be when arrow down is pushed
  _getNextHighlighted($items) {
    const $highlighted = this.getHighlighted($items);

    /* istanbul ignore if: complicated generic test, but simple code */
    if (!$highlighted.length) {
      return $items.first();
    }

    const nextIndex = $items.index($highlighted) + 1;

    if (nextIndex === $items.length) {
      return $highlighted;
    }

    return $items.eq(nextIndex);
  },

  // looks for the highlighted items position and scrolls the list so that it is shown.
  // pass 'middle' as the offsetDir to place the highlighted element in the middle
  // of the scrollable window
  /* istanbul ignore next: hard to test, but battle tested */
  scrollTo($items, $scrollItem, offsetDir) {
    if (!$items.length) return;

    if (!$scrollItem || !$scrollItem.length) {
      $scrollItem = this.getHighlighted($items);
    }

    if (!$scrollItem.length) return;

    const $scrollEl = this.view.$(this.getOption('scroll'));

    const picklistScrollTop = $scrollEl.scrollTop();
    const picklistHeight = $scrollEl.outerHeight();
    const childViewHeight = $scrollItem.outerHeight();
    const childViewTop = $scrollItem.position().top;
    const childViewBottom = childViewTop + childViewHeight - picklistHeight;
    let offset = 0;

    if (offsetDir === 'middle') {
      offset = (picklistHeight / 2) - (childViewHeight / 2);
    }

    if (childViewTop < 0) {
      $scrollEl.scrollTop(picklistScrollTop + childViewTop + offset);
    }

    if (childViewBottom > 0) {
      $scrollEl.scrollTop(picklistScrollTop + childViewBottom + offset);
    }
  },

  // Keylistener non-transport related events
  // -----------------------------------------

  // simulates the click trigger on the currently highlighted element
  onSelect(evt) {
    evt.preventDefault();

    this.view.$('.is-highlighted').click();
  },
});
