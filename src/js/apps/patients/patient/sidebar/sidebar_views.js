import Radio from 'backbone.radio';
import Backbone from 'backbone';
import { View } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import { PATIENT_STATUS } from 'js/static';
import intl from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';

import 'scss/modules/widgets.scss';

import Optionlist from 'js/components/optionlist';

import { WidgetCollectionView } from 'js/apps/patients/shared/widgets/widgets_views';

import 'js/apps/patients/shared/patient-sidebar.scss';
import './patient-sidebar.scss';

const i18n = intl.patients.patient.sidebar.sidebarViews;

const NameView = View.extend({
  tagName: 'h1',
  className: 'patient-sidebar__name',
  template: hbs`{{ first_name }} {{ last_name }}`,
  modelEvents: {
    'change': 'render',
  },
});

const SidebarView = View.extend({
  className: 'patient-sidebar flex-region',
  template: hbs`
    <div data-name-region></div>
    <span class="patient-sidebar__icon">{{far "address-card"}}</span>
    <button class="button--icon patient-sidebar__menu js-menu">{{far "ellipsis"}}</button>
    <div class="patient-sidebar__widgets" data-widgets-region></div>
  `,
  regions: {
    name: '[data-name-region]',
    widgets: {
      el: '[data-widgets-region]',
      regionClass: PreloadRegion,
    },
  },
  onRender() {
    this.showChildView('name', new NameView({
      model: this.model,
    }));

    this.showChildView('widgets', new WidgetCollectionView({
      model: this.model,
      collection: this.collection,
      itemClassName: 'patient-sidebar__section',
    }));
  },
  triggers: {
    'click @ui.menu': 'click:menu',
  },
  ui: {
    menu: '.js-menu',
  },
  onClickMenu() {
    const workspacePatient = this.model.getWorkspacePatient();
    const workspacePatientStatus = workspacePatient.get('status');

    const canEditPatient = this.model.canEdit();

    const menuOptions = new Backbone.Collection([
      {
        event: canEditPatient ? 'click:patientEdit' : 'click:patientView',
        text: canEditPatient ? i18n.menuOptions.edit : i18n.menuOptions.view,
      },
    ]);

    if (workspacePatient.canEdit()) {
      menuOptions.push({
        event: 'click:activeStatus',
        text: workspacePatientStatus !== PATIENT_STATUS.ACTIVE ? i18n.menuOptions.activate : i18n.menuOptions.inactivate,
      });

      if (workspacePatientStatus !== PATIENT_STATUS.ARCHIVED) {
        menuOptions.push({
          event: 'click:shouldArchive',
          text: i18n.menuOptions.archive,
        });
      }
    }

    const optionlist = new Optionlist({
      ui: this.ui.menu,
      uiView: this,
      headingText: i18n.menuOptions.headingText,
      itemTemplate: hbs`{{ text }}`,
      lists: [{ collection: menuOptions }],
      align: 'right',
      popWidth: 248,
    });

    this.listenTo(optionlist, 'select', model => {
      const event = model.get('event');

      this.triggerMethod(event);
    });

    optionlist.show();
  },
  onClickShouldArchive() {
    const modal = Radio.request('modal', 'show:small', {
      bodyText: i18n.archiveModal.bodyText,
      headingText: i18n.archiveModal.headingText,
      submitText: i18n.archiveModal.submitText,
      buttonClass: 'button--red',
      onSubmit: () => {
        modal.destroy();
        this.triggerMethod('click:archivedStatus');
      },
    });
  },
});

export {
  SidebarView,
};
