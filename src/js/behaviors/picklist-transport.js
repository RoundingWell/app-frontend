import { Behavior } from 'marionette';

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
        'transport:select': ENTER_KEY,
        'close': [ESCAPE_KEY, TAB_KEY],
      },
    },
  ],

  options: {
    items: '.js-picklist-item',
    scroll: '.js-picklist-scroll',
  },

  events() {
    const evts = {};

    // mouseover is delegated; ignore movement within the same item below.
    evts[`mouseover ${ this.getOption('items') }`] = this.onHoverItem;

    return evts;
  },

  // must be onAttach, so that the width of droplist is already set for scrolling calc
  onAttach() {
    const items = this.getItems();
    this.scrollTo(items, items.filter(item => item.classList.contains('is-selected')), 'middle');
  },

  onHoverItem(evt) {
    const item = evt.delegateTarget;
    if (item.contains(evt.relatedTarget)) return;

    this.updateTransport(this.getItems(), [item]);
  },

  onTransportDown(evt) {
    evt.preventDefault();

    const items = this.getItems();
    const highlighted = this._getNextHighlighted(items);

    this.updateTransport(items, highlighted);

    this.scrollTo(items);
  },

  onTransportUp(evt) {
    evt.preventDefault();

    const items = this.getItems();
    const highlighted = this._getPrevHighlighted(items);

    this.updateTransport(items, highlighted);

    this.scrollTo(items);
  },

  getItems() {
    return Array.from(this.view.$(this.getOption('items')));
  },

  getHighlighted(items) {
    return items.filter(item => item.classList.contains('is-highlighted'));
  },

  updateTransport(items, highlighted) {
    items.forEach(item => item.classList.remove('is-highlighted'));
    highlighted.forEach(item => item.classList.add('is-highlighted'));
  },

  // determines based on what is highlighted (or not)
  // what the next highlighted item will be when arrow up is pushed
  _getPrevHighlighted(items) {
    const highlighted = this.getHighlighted(items);

    /* istanbul ignore if: complicated generic test, but simple code */
    if (!highlighted.length) {
      return items.slice(-1);
    }

    const nextIndex = items.indexOf(highlighted[0]) - 1;

    if (nextIndex < 0) {
      return highlighted;
    }

    return [items[nextIndex]];
  },

  // determines based on what is highlighted (or not)
  // what the next highlighted item will be when arrow down is pushed
  _getNextHighlighted(items) {
    const highlighted = this.getHighlighted(items);

    /* istanbul ignore if: complicated generic test, but simple code */
    if (!highlighted.length) {
      return items.slice(0, 1);
    }

    const nextIndex = items.indexOf(highlighted[0]) + 1;

    if (nextIndex === items.length) {
      return highlighted;
    }

    return [items[nextIndex]];
  },

  // looks for the highlighted items position and scrolls the list so that it is shown.
  // pass 'middle' as the offsetDir to place the highlighted element in the middle
  // of the scrollable window
  /* istanbul ignore next: hard to test, but battle tested */
  scrollTo(items, scrollItems, offsetDir) {
    if (!items.length) return;

    if (!scrollItems || !scrollItems.length) {
      scrollItems = this.getHighlighted(items);
    }

    const [scrollItem] = scrollItems;
    if (!scrollItem) return;

    const [scrollEl] = this.view.$(this.getOption('scroll'));

    const picklistScrollTop = scrollEl.scrollTop;
    const picklistHeight = scrollEl.offsetHeight;
    const childViewHeight = scrollItem.offsetHeight;
    const childViewTop = scrollItem.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top;
    const childViewBottom = childViewTop + childViewHeight - picklistHeight;
    let offset = 0;

    if (offsetDir === 'middle') {
      offset = (picklistHeight / 2) - (childViewHeight / 2);
    }

    if (childViewTop < 0) {
      scrollEl.scrollTop = picklistScrollTop + childViewTop + offset;
    }

    if (childViewBottom > 0) {
      scrollEl.scrollTop = picklistScrollTop + childViewBottom + offset;
    }
  },

  // Keylistener non-transport related events
  // -----------------------------------------

  // simulates the click trigger on the currently highlighted element
  onTransportSelect(evt) {
    evt.preventDefault();

    this.view.$('.is-highlighted')[0]?.click();
  },
});
