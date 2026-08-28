import Radio from 'backbone.radio';
import { View } from 'marionette';

import intl from 'js/i18n';

import AnnouncementTemplate from './announcement.hbs';
import DesignUpdateTemplate from './design-update.hbs';

import './whats-new.scss';

const WHATS_NEW_VERSION = 'v6-design-update';
const WHATS_NEW_URL = 'https://www.roundingwell.com/rw-design-update';

const AnnouncementView = View.extend({
  className: 'app-nav__announcement',
  template: AnnouncementTemplate,
  ui: {
    dismiss: '.js-dismiss',
    update: '.js-update',
  },
  triggers: {
    'click @ui.dismiss': 'dismiss',
    'click @ui.update': 'show:update',
  },
});

const DesignUpdateView = View.extend({
  className: 'whats-new-update',
  template: DesignUpdateTemplate,
  templateContext: {
    title: intl.globals.appNav.appNavViews.whatsNew.modal.heading,
    url: WHATS_NEW_URL,
  },
});

function showWhatsNew() {
  return Radio.request('modal', 'show', {
    bodyView: new DesignUpdateView(),
    cancelText: false,
    className: 'modal modal--form modal--form-large whats-new-modal',
    headingText: intl.globals.appNav.appNavViews.whatsNew.modal.heading,
    headerIcon: 'circle-info',
    submitText: intl.globals.appNav.appNavViews.whatsNew.modal.done,
  });
}

export {
  AnnouncementView,
  DesignUpdateView,
  WHATS_NEW_URL,
  WHATS_NEW_VERSION,
  showWhatsNew,
};
