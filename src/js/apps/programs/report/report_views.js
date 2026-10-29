import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/card-list.scss';

import intl from 'js/i18n';

import { isPublishedProgram, observeMetadata, ownerName, reportMetadata } from './report-data';
import { reportUrl, navigateReportLink } from './report-links';

import LayoutTemplate from './layout.hbs';
import FlowTemplate from './flow.hbs';
import ActionTemplate from './action.hbs';

import 'scss/domain/work-card.scss';
import 'scss/domain/action-card.scss';
import 'scss/domain/action-icons.scss';
import './report.scss';

const i18n = intl.programs.report;

const EmptyActionsView = View.extend({
  tagName: 'li',
  className: 'program-report__empty',
  template: hbs`<p>{{ @intl.programs.report.emptyActionsText }}</p>`,
});

const ActionView = View.extend({
  tagName: 'li',
  className: 'work-card action-card work-card--focus-surface program-report__action',
  template: ActionTemplate,
  ui: {
    link: '.js-action-link',
  },
  events: {
    'click @ui.link': navigateReportLink,
  },
  modelEvents: {
    'change': 'render',
    'change:_form': 'observeForm',
  },
  initialize() {
    this.observeForm();
    observeMetadata(this, this.model);
    const flow = this.getOption('flow');
    if (flow) observeMetadata(this, flow);
  },
  observeForm() {
    if (this.form) this.stopListening(this.form);
    this.form = this.model.getForm();
    if (this.form) this.listenTo(this.form, 'change:name', this.render);
  },
  templateContext() {
    const flow = this.getOption('flow');
    const owner = this.model.getOwner();
    const flowOwner = flow?.getOwner();
    const day = this.model.get('days_until_due');
    const actionPath = flow ? `program-flow/${ flow.id }` : `program/${ this.getOption('program').id }`;

    return {
      ...reportMetadata(this.model),
      actionUrl: reportUrl(`${ actionPath }/action/${ this.model.id }`),
      ...this.ownerContext(owner, flow, flowOwner),
      hasDueDay: day !== null && day !== undefined,
      hasForm: !!this.form,
      formName: this.form?.get('name') || i18n.formUnavailableText,
      uploadTypes: (this.model.get('allowed_uploads') || []).join(', '),
    };
  },
  ownerContext(owner, flow, flowOwner) {
    return {
      ownerName: !owner && flow ? i18n.flowOwnerText : ownerName(owner),
      inheritedOwner: !owner && flowOwner && ownerName(flowOwner),
    };
  },
  focusTitle() {
    this.getUI('link')[0].focus({ preventScroll: true });
    this.el.scrollIntoView({ block: 'nearest' });
  },
});

const ActionsView = CollectionView.extend({
  tagName() {
    return this.getOption('flow') ? 'ol' : 'ul';
  },
  className() {
    return `card-list program-report__actions${ this.getOption('flow') ? ' program-report__actions--ordered' : '' }`;
  },
  childView: ActionView,
  emptyView: EmptyActionsView,
  childViewOptions() {
    return { program: this.getOption('program'), flow: this.getOption('flow') };
  },
  focusAction(actionId) {
    const model = this.collection.get(actionId);
    const view = model && this.children.findByModel(model);
    if (!view) return false;
    view.focusTitle();
    return true;
  },
});

const FlowView = View.extend({
  tagName: 'section',
  className: 'program-report__flow',
  template: FlowTemplate,
  initialize() {
    observeMetadata(this, this.model);
  },
  templateContext() {
    return {
      ...reportMetadata(this.model),
      ownerName: ownerName(this.model.getOwner()),
    };
  },
});

const LayoutView = View.extend({
  tagName: 'main',
  className: 'program-report',
  template: LayoutTemplate,
  ui: {
    link: '.js-report-link',
    heading: '.js-report-heading',
    currentLink: '.program-report__nav-link[aria-current]',
    missingAction: '.js-missing-action',
  },
  events: {
    'click @ui.link': navigateReportLink,
  },
  regions: {
    flow: '[data-flow-region]',
    actions: '[data-actions-region]',
  },
  templateContext() {
    const flow = this.getOption('flow');
    const program = this.model;

    return {
      ...reportMetadata(program),
      programsUrl: reportUrl('programs'),
      overviewUrl: reportUrl(`program/${ program.id }`),
      workspaces: program.getUserWorkspaces().pluck('name').join(', '),
      hasFlow: !!flow,
      flows: this.getOption('flows').map(item => ({
        id: item.id,
        name: item.get('name'),
        url: reportUrl(`program-flow/${ item.id }`),
        isCurrent: item.id === flow?.id,
        inactiveStatus: isPublishedProgram(item) ? null : reportMetadata(item).status,
      })),
    };
  },
  onRender() {
    const flow = this.getOption('flow');
    if (flow) this.showChildView('flow', new FlowView({ model: flow }));
    this.showChildView('actions', new ActionsView({
      collection: this.getOption('actions'),
      program: this.model,
      flow,
    }));
  },
  focusHeading() {
    this.getUI('missingAction')[0].hidden = true;
    const target = this.getOption('flow') ? 'currentLink' : 'heading';
    this.getUI(target)[0].focus({ preventScroll: true });
  },
  focusAction(actionId) {
    const found = this.getChildView('actions').focusAction(actionId);
    this.getUI('missingAction')[0].hidden = found;
    if (!found) this.getUI('missingAction')[0].focus();
  },
});

export { LayoutView };
