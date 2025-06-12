import Radio from 'backbone.radio';
import { Behavior } from 'marionette';

export default Behavior.extend({
  initialize() {
    const userActivityCh = Radio.channel('user-activity');
    this.listenTo(userActivityCh, 'window:resize', this.fixWidth);

    this.listenTo(this.view, 'fix:list:width', this.fixWidth);
  },
  fixWidth() {
    /* istanbul ignore if */
    if (!this.view.isRendered()) return;

    const headerWidth = this.view.ui.listHeader.width();
    const listWidth = this.view.ui.list.contents().width();
    const listPadding = parseInt(this.view.ui.list.css('paddingRight'), 10);
    const scrollbarWidth = headerWidth - listWidth;

    this.view.ui.list.css({ paddingRight: `${ listPadding - scrollbarWidth }px` });
  },
});
