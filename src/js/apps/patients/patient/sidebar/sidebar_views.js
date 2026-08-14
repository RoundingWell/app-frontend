import Radio from 'backbone.radio';
import Backbone from 'backbone';
import { View, CollectionView } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';
import 'scss/modules/loader.scss';
import 'scss/modules/sidebar.scss';
import 'scss/modules/skeleton.scss';

import { PATIENT_STATUS } from 'js/static';
import intl, { renderTemplate } from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';

import Optionlist from 'js/components/optionlist';

import { WidgetCollectionView } from 'js/apps/patients/shared/widgets/widgets_views';

import LoadingTemplate from './loading.hbs';
import SidebarTemplate from './sidebar.hbs';

import 'js/apps/patients/shared/patient-sidebar.scss';
import './patient-sidebar.scss';

const i18n = intl.patients.patient.sidebar.sidebarViews;

const sectionLabelTemplates = {
  collapse: hbs`{{{formatMessage (intlGet "patients.patient.sidebar.sidebarViews.sidebarSectionView.collapseSectionLabel") section=name}}}`,
  expand: hbs`{{{formatMessage (intlGet "patients.patient.sidebar.sidebarViews.sidebarSectionView.expandSectionLabel") section=name}}}`,
};

const NameView = View.extend({
  tagName: 'button',
  className: 'patient-sidebar__name',
  template: hbs`
    <span class="patient-sidebar__name-text">{{ first_name }} {{ last_name }}</span>
    <span class="patient-sidebar__name-chevron" aria-hidden="true">{{fas "chevron-right"}}</span>
  `,
  attributes: {
    type: 'button',
  },
  triggers: {
    'click': 'click:patient',
  },
  modelEvents: {
    'change': 'render',
  },
});

const SidebarSectionView = View.extend({
  className: 'patient-sidebar__card',
  template: hbs`
    <h2 class="patient-sidebar__card-heading">
      <button class="patient-sidebar__card-toggle js-toggle-section" type="button" aria-label="{{ toggleLabel }}" aria-expanded="{{ isExpanded }}" aria-controls="{{ widgetsRegionId }}">
        <span>{{ name }}</span>
        <span class="patient-sidebar__card-toggle-icon">{{far "chevron-down"}}</span>
      </button>
    </h2>
    <div id="{{ widgetsRegionId }}" data-widgets-region></div>
  `,
  ui: {
    toggleSection: '.js-toggle-section',
    widgets: '[data-widgets-region]',
  },
  regions: {
    widgets: '[data-widgets-region]',
  },
  triggers: {
    'click @ui.toggleSection': 'click:toggle',
  },
  initialize() {
    this.isExpanded = true;
    this.widgetsRegionId = `patient-sidebar-section-${ this.cid }`;
  },
  onRender() {
    this.showChildView('widgets', new WidgetCollectionView({
      model: this.getOption('patient'),
      collection: this.model.getWidgets(),
      itemClassName: 'patient-sidebar__section',
    }));

    this.updateDisclosure();
  },
  onClickToggle() {
    this.isExpanded = !this.isExpanded;
    this.updateDisclosure();
  },
  getToggleLabel() {
    const labelTemplate = this.isExpanded ? sectionLabelTemplates.collapse : sectionLabelTemplates.expand;

    return renderTemplate(labelTemplate, { name: this.model.get('name') });
  },
  updateDisclosure() {
    this.ui.toggleSection
      .attr('aria-expanded', String(this.isExpanded))
      .attr('aria-label', this.getToggleLabel());
    this.ui.widgets.prop('hidden', !this.isExpanded);
    this.$el.toggleClass('is-collapsed', !this.isExpanded);
  },
  templateContext() {
    return {
      isExpanded: this.isExpanded,
      toggleLabel: this.getToggleLabel(),
      widgetsRegionId: this.widgetsRegionId,
    };
  },
});

const SidebarsView = CollectionView.extend({
  className: 'patient-sidebar__cards',
  childView: SidebarSectionView,
  childViewOptions() {
    return {
      patient: this.model,
    };
  },
  viewComparator: false,
});

const SidebarLoadingView = View.extend({
  className: 'loader patient-sidebar__loader',
  attributes: {
    'aria-busy': 'true',
    'role': 'status',
  },
  template: LoadingTemplate,
  templateContext() {
    return { sections: new Array(4).fill(null) };
  },
});

const SidebarView = View.extend({
  className() {
    const listSidebarClass = this.getOption('isListSidebar') ? ' patient-sidebar--list' : '';
    return `patient-sidebar flex-region${ listSidebarClass }`;
  },
  template: SidebarTemplate,
  regions: {
    name: '[data-name-region]',
    sidebars: {
      el: '[data-sidebars-region]',
      regionClass: PreloadRegion,
    },
  },
  onRender() {
    this.showChildView('name', new NameView({
      model: this.model,
    }));

    if (!this.collection) return;

    this.showChildView('sidebars', new SidebarsView({
      model: this.model,
      collection: this.collection,
    }));
  },
  templateContext() {
    return {
      isClosable: this.getOption('isClosable'),
      isListSidebar: this.getOption('isListSidebar'),
    };
  },
  childViewTriggers: {
    'click:patient': 'click:patient',
  },
  triggers: {
    'click @ui.menu': 'click:menu',
    'click @ui.close': 'click:close',
  },
  ui: {
    close: '.js-close',
    menu: '.js-menu',
  },
  focusClose() {
    this.ui.close.trigger('focus');
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
      buttonClass: 'button button--danger',
      onSubmit: () => {
        modal.destroy();
        this.triggerMethod('click:archivedStatus');
      },
    });
  },
});

export {
  SidebarView,
  SidebarLoadingView,
};
