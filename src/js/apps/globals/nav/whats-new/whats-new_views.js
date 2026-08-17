import Radio from 'backbone.radio';
import { View } from 'marionette';

import intl from 'js/i18n';

import AnnouncementTemplate from './announcement.hbs';
import GuideTemplate from './guide.hbs';

import './whats-new.scss';

const WHATS_NEW_VERSION = 'v6-redesign';

const AnnouncementView = View.extend({
  className: 'app-nav__announcement',
  template: AnnouncementTemplate,
  ui: {
    dismiss: '.js-dismiss',
    guide: '.js-guide',
  },
  triggers: {
    'click @ui.dismiss': 'dismiss',
    'click @ui.guide': 'show:guide',
  },
});

const GuideView = View.extend({
  template: GuideTemplate,
});

function showWhatsNewGuide() {
  return Radio.request('modal', 'show', {
    bodyView: new GuideView(),
    cancelText: false,
    className: 'modal modal--large whats-new-modal',
    headingText: intl.globals.appNav.appNavViews.whatsNew.guide.heading,
    headerIcon: 'circle-info',
    submitText: intl.globals.appNav.appNavViews.whatsNew.guide.done,
  });
}

export {
  AnnouncementView,
  GuideView,
  WHATS_NEW_VERSION,
  showWhatsNewGuide,
};
