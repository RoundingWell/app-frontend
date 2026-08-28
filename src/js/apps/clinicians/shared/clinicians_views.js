import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import Backbone from 'backbone';

import 'scss/modules/buttons.scss';

import RoleComponent from './components/role_component';
import TeamComponent from 'js/components/team';
import WorkspacesManagerComponent from 'js/components/workspaces-manager';

import intl, { renderTemplate } from 'js/i18n';

import Droplist from 'js/components/droplist';

import './clinician-state.scss';

const i18n = intl.clinicians.shared.clinicianViews;

const WorkspacesComponent = WorkspacesManagerComponent.extend({
  removeMemberWorkspace(workspace) {
    if (this.member.isNew()) {
      WorkspacesManagerComponent.prototype.removeMemberWorkspace.call(this, workspace);
      return;
    }

    const modal = Radio.request('modal', 'show:small', {
      bodyText: renderTemplate(hbs`{{formatMessage (intlGet "clinicians.shared.clinicianViews.workspacesComponent.removeModal.bodyText") workspace=workspace team=team}}`, {
        workspace: workspace.get('name'),
        team: this.member.getTeam().get('name'),
      }),
      headingText: i18n.workspacesComponent.removeModal.headingText,
      submitText: i18n.workspacesComponent.removeModal.submitText,
      buttonClass: 'button button--danger',
      onSubmit: () => {
        modal.destroy();
        WorkspacesManagerComponent.prototype.removeMemberWorkspace.call(this, workspace);
      },
    });
  },
});

const ActiveState = {
  id: 'enabled',
  state: 'active',
  icon: {
    type: 'fas',
    icon: 'circle-check',
  },
  name: i18n.stateComponent.active,
};

const PendingState = {
  id: 'enabled',
  state: 'pending',
  icon: {
    type: 'fas',
    icon: 'circle-half-stroke',
  },
  name: i18n.stateComponent.pending,
};

const DisabledState = {
  id: 'disabled',
  state: 'disabled',
  icon: {
    type: 'far',
    icon: 'circle-minus',
  },
  name: i18n.stateComponent.disabled,
};

const StateCompactTemplate = hbs`<span class="clinician-state clinician-state--{{ state }}">{{fa icon.type icon.icon}}</span>`;

const StateTemplate = hbs`<span class="clinician-state clinician-state--{{ state }}">{{fa icon.type icon.icon}}<span>{{ name }}</span></span>`;

const StateComponent = Droplist.extend({
  isCompact: false,
  popWidth() {
    const isCompact = this.getOption('isCompact');

    return isCompact ? null : this.getView().$el.outerWidth();
  },
  picklistOptions() {
    return {
      itemTemplate: StateTemplate,
      headingText: i18n.stateComponent.headingText,
    };
  },
  viewOptions() {
    const isCompact = this.getOption('isCompact');
    return {
      className: isCompact ? 'button button--compact' : 'button button--secondary w-100',
      template: isCompact ? StateCompactTemplate : StateTemplate,
    };
  },
  initialize({ selectedId, isActive }) {
    this.collection = new Backbone.Collection([isActive ? ActiveState : PendingState, DisabledState]);
    this.setState('selected', this.collection.get(selectedId));
  },
});

export {
  RoleComponent,
  WorkspacesComponent,
  TeamComponent,
  StateComponent,
};
