import { extend } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';
import { mixinState } from 'marionette.toolkit';

import 'scss/modules/modals.scss';

import intl from 'js/i18n';
import trim from 'js/utils/formatting/trim';

import { WorkspacesComponent, TeamComponent, RoleComponent } from 'js/apps/clinicians/shared/clinicians_views';

import InputFocusBehavior from 'js/behaviors/input-focus';
import ClinicianModalTemplate from './clinician-modal.hbs';

const i18n = intl.clinicians.clinicianModal.clinicianModalViews;

const InputView = View.extend({
  behaviors() {
    if (!this.getOption('shouldFocus')) return;

    return [
      {
        behaviorClass: InputFocusBehavior,
        selector: '.js-input',
      },
    ];
  },
  className: 'pos--relative',
  template: hbs`
    <input class="input-primary w-100 js-input {{#if hasError}}has-error{{/if}}" placeholder="{{ placeholder }}" value="{{ value }}" />
  `,
  templateContext() {
    const errors = this.getOption('state').get('errors');

    return {
      hasError: errors && errors[this.getOption('attr')],
      placeholder: this.getOption('placeholder'),
      value: this.model.get(this.getOption('attr')),
    };
  },
  ui: {
    input: '.js-input',
  },
  events: {
    'input @ui.input': 'onChange',
  },
  initialize({ state }) {
    this.listenTo(state, 'change:errors', this.render);
  },
  onChange() {
    const text = this.ui.input.val();
    this.model.set(this.getOption('attr'), trim(text));
  },
  onDomRefresh() {
    if (this.getOption('shouldFocus')) {
      this.ui.input.focus();
    }
  },
});

const ClinicianModal = View.extend({
  className: 'modal__content',
  regions: {
    name: '[data-name-region]',
    email: '[data-email-region]',
    role: '[data-role-region]',
    team: '[data-team-region]',
    workspaces: '[data-workspaces-region]',
  },
  modelEvents: {
    'change': 'onChange',
  },
  template: ClinicianModalTemplate,
  initialize({ state }) {
    this.initState({ state });
  },
  onRender() {
    this.showNameView();
    this.showEmailView();
    this.showRole();
    this.showTeam();
    this.showWorkspacesComponent();
  },
  showNameView() {
    this.showChildView('name', new InputView({
      model: this.model,
      state: this.getState(),
      attr: 'name',
      placeholder: i18n.clinicianModal.name,
      shouldFocus: true,
    }));
  },
  showEmailView() {
    this.showChildView('email', new InputView({
      model: this.model,
      state: this.getState(),
      attr: 'email',
      placeholder: i18n.clinicianModal.email,
    }));
  },
  showRole() {
    const roleComponent = new RoleComponent({
      role: this.model.getRole(),
      className: 'modal__form-component',
    });

    this.listenTo(roleComponent, 'change:role', role => {
      this.model.setRole(role);
    });

    this.showChildView('role', roleComponent);
  },
  showTeam() {
    const teamComponent = new TeamComponent({
      team: this.model.getTeam(),
      className: 'modal__form-component',
    });

    this.listenTo(teamComponent, 'change:team', team => {
      this.model.setTeam(team);
    });

    this.showChildView('team', teamComponent);
  },
  showWorkspacesComponent() {
    const workspacesManager = this.showChildView('workspaces', new WorkspacesComponent({
      className: 'modal__form-component',
      workspaces: Radio.request('bootstrap', 'workspaces'),
      member: this.model,
    }));

    this.listenTo(workspacesManager, {
      'add:member'(clinician, workspace) {
        this.model.addWorkspace(workspace);
      },
      'remove:member'(clinician, workspace) {
        this.model.removeWorkspace(workspace);
      },
    });
  },
});

mixinState(ClinicianModal);

function getClinicianModal(opts) {
  const clinician = opts.clinician;
  const bodyView = new ClinicianModal({
    model: clinician,
  });

  return extend({
    bodyView,
    headerIcon: 'users-gear',
  }, i18n.clinicianModal, opts);
}

export {
  getClinicianModal,
};
