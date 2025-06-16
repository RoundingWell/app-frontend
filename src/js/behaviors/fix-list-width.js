import Radio from 'backbone.radio';
import { Behavior } from 'marionette';

export default Behavior.extend({
  initialize() {
    const userActivityCh = Radio.channel('user-activity');
    this.listenTo(userActivityCh, 'window:resize', this.fixWidth);
  },
  ui: {
    listHeader: '.js-list-header',
    list: '.js-list',
  },
  onChildViewAttach() {
    this.fixWidth();
  },
  onChildViewRenderChildren() {
    this.fixWidth();
  },
  fixWidth() {
    /* istanbul ignore if */
    if (!this.view.isAttached()) return;

    const headerWidth = this.ui.listHeader.width();
    const listWidth = this.ui.list.contents().width();
    const listPadding = parseInt(this.ui.list.css('paddingRight'), 10);
    const scrollbarWidth = headerWidth - listWidth;

    this.ui.list.css({ paddingRight: `${ listPadding - scrollbarWidth }px` });
  },
});
