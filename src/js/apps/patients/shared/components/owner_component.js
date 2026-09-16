import { find } from 'underscore';
import { Radio } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import './owner-component.scss';

const i18n = intl.patients.shared.components.ownerComponent;

const OwnerItemTemplate = hbs`<div class="owner-component">{{matchText name query}} <span class="owner-component__team">{{matchText abbr query}}</span></div>`;

const CLASS_OPTIONS = [
  'isCompact',
  'headingText',
  'infoText',
  'placeholderText',
  'hasTeams',
  'hasClinicians',
  'hasCurrentClinician',
  'owner',
  'workspaces',
];

let currentWorkspaceCache;
let teamsCollection;
let cliniciansCache = {};

function getTeams(workspaces, currentUser) {
  if (teamsCollection) return teamsCollection;

  if (currentUser.can('work:team:manage')) {
    teamsCollection = Radio.request('entities', 'teams:collection', [currentUser.getTeam()]);
    return teamsCollection;
  }

  teamsCollection = Radio.request('entities', 'teams:collection');

  workspaces.each(workspace => {
    const clinicians = getClinicians(workspace, currentUser);
    teamsCollection.add(clinicians.invoke('getTeam'));
  });

  return teamsCollection;
}

function getClinicians(workspace, currentUser) {
  if (cliniciansCache[workspace.id]) return cliniciansCache[workspace.id];

  if (currentUser.can('work:team:manage')) {
    cliniciansCache[workspace.id] = currentUser.getTeam().getAssignableClinicians();
    return cliniciansCache[workspace.id];
  }

  cliniciansCache[workspace.id] = workspace.getAssignableClinicians();
  return cliniciansCache[workspace.id];
}

export default Droplist.extend({
  isCompact: false,
  headingText: i18n.headingText,
  placeholderText: i18n.placeholderText,
  hasTeams: true,
  hasClinicians: true,
  hasCurrentClinician: true,
  popWidth() {
    return this.isCompact ? null : this.el.offsetWidth;
  },
  picklistOptions() {
    const lists = this.getLists();

    const showCurrentUser = this.hasCurrentClinician && find(lists, ({ collection }) => {
      return collection.get(this.currentUser);
    });

    return {
      lists,
      itemTemplate: OwnerItemTemplate,
      itemTemplateContext() {
        if (this.model.type === 'teams') return;
        return {
          abbr: this.model.getTeam().get('abbr'),
        };
      },
      isSelectlist: true,
      infoText: this.infoText,
      headingText: this.headingText,
      placeholderText: this.placeholderText,
      canClear: showCurrentUser,
      clearText: this.currentUser.get('name'),
    };
  },
  className() {
    return this.getOption('isCompact') ?
      'owner-component owner-component--compact button button--compact' :
      'owner-component button button--secondary w-100';
  },
  templateContext() {
    const selected = this.getState().get('selected');
    const isTeam = selected?.type === 'teams';

    return {
      attr: this.isCompact && isTeam ? 'abbr' : 'name',
      icon: { type: 'far', icon: 'circle-user' },
    };
  },
  initialize(options) {
    this.mergeOptions(options, CLASS_OPTIONS);

    this.currentUser = Radio.request('bootstrap', 'currentUser');

    const currentWorkspace = Radio.request('workspace', 'current');

    if (!this.workspaces) this.workspaces = Radio.request('entities', 'workspaces:collection', [currentWorkspace]);

    if (currentWorkspaceCache !== currentWorkspace.id) {
      teamsCollection = null;
      cliniciansCache = {};
      currentWorkspaceCache = currentWorkspace.id;
    }

    this.getState().set({ selected: this.owner });
  },
  getLists() {
    const lists = [];

    if (this.hasClinicians) {
      this.workspaces.each(workspace => {
        const clinicians = getClinicians(workspace, this.currentUser);

        if (!clinicians.length) return;

        lists.push({
          collection: clinicians,
          headingText: workspace.get('name'),
        });
      });
    }

    if (this.hasTeams) {
      lists.push({
        collection: getTeams(this.workspaces, this.currentUser),
        headingText: lists.length ? i18n.teamsHeadingText : null,
      });
    }

    return lists;
  },
  onPicklistSelect({ model }) {
    this.getState().set('selected', model || this.currentUser);

    this.popRegion.empty();
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:owner', selected);
  },
});
