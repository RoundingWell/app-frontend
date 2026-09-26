import { bind } from 'underscore';
import { Radio, Behavior } from 'marionette';

import 'scss/modules/fill-window.scss';

const userActivityCh = Radio.channel('user-activity');
const topRegionCh = Radio.channel('top-region');

export default Behavior.extend({
  regionName: 'region',
  className: 'fill-window',
  initialize(options) {
    this.mergeOptions(options, ['regionName', 'className']);
  },
  onInitialize() {
    this.region = this.view.getRegion(this.regionName);
    this.listenTo(this.region, {
      'empty': bind(this.view.triggerMethod, this.view, 'region:empty'),
      'show': bind(this.view.triggerMethod, this.view, 'region:show'),
    });
  },
  onRegionShow() {
    this.listenTo(userActivityCh, 'body:down', this.onBodyDown);
    this.listenTo(userActivityCh, 'iframe:focus', this.onIframeFocus);
    this.el.classList.add(this.className);
  },
  onRegionEmpty() {
    this.stopListening(userActivityCh);
    if (!this.region.isSwappingView()) this.el.classList.remove(this.className);
  },
  onBodyDown({ target }) {
    this.emptyOnActvity(target);
  },
  onIframeFocus(iframeEl) {
    this.emptyOnActvity(iframeEl);
  },
  emptyOnActvity(el) {
    if (!this.region.hasView() || topRegionCh.request('contains', this.view, el)) return;

    this.view.empty();
  },
});
