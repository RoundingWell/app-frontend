import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Radio from 'backbone.radio';

import { Collection as Teams } from 'js/entities-service/entities/teams';

import TeamComponent from 'js/views/shared/components/team';

import teamsFixture from 'fixtures/test/teams.json';

describe('Team Component', () => {
  let teams;

  beforeEach(() => {
    teams = new Teams(teamsFixture);

    Radio.reply('bootstrap', 'teams', () => teams);
  });

  afterEach(() => {
    Radio.reset('bootstrap');
  });

  it('uses the bootstrap teams collection and starts without a selection by default', () => {
    const component = new TeamComponent();

    expect(component.collection).toBe(teams);
    expect(component.getState('selected')).toBeUndefined();
    expect(component.defaultText()).toBe('Select Team...');
  });

  it('uses compact view options when requested', () => {
    const component = new TeamComponent({ isCompact: true });

    expect(component.defaultText()).toBeNull();
    expect(component.viewOptions()).toEqual({
      className: 'button-secondary--compact',
      templateContext: {
        defaultText: null,
        attr: 'abbr',
        icon: { type: 'far', icon: 'circle-user' },
      },
    });
  });

  it('uses full-width view options and pop width when not compact', () => {
    const component = new TeamComponent();

    component.getView = () => ({
      $el: {
        outerWidth: () => 240,
      },
    });

    expect(component.popWidth()).toBe(240);
    expect(component.viewOptions()).toEqual({
      className: 'button-secondary w-100',
      templateContext: {
        defaultText: 'Select Team...',
        attr: 'name',
        icon: { type: 'far', icon: 'circle-user' },
      },
    });
  });

  it('builds select-list picklist options', () => {
    const component = new TeamComponent({ canClear: true });
    const picklistOptions = component.picklistOptions();

    expect(picklistOptions.canClear).toBe(true);
    expect(picklistOptions.isSelectlist).toBe(true);
    expect(picklistOptions.headingText).toBe('Update Team');
    expect(picklistOptions.placeholderText).toBe('Team...');
    expect(typeof picklistOptions.itemTemplate).toBe('function');
  });

  it('selects the provided team and emits changes', () => {
    const changeTeam = vi.fn();
    const selectedTeam = teams.find({ abbr: 'CO' });
    const nextTeam = teams.find({ abbr: 'PHS' });
    const component = new TeamComponent({ team: selectedTeam.id });

    component.on('change:team', changeTeam);

    expect(component.getState('selected')).toBe(selectedTeam);

    component.onChangeSelected(nextTeam);
    component.onChangeSelected(null);

    expect(changeTeam).toHaveBeenNthCalledWith(1, nextTeam);
    expect(changeTeam).toHaveBeenNthCalledWith(2, null);
  });

  it('returns null pop width when compact', () => {
    const component = new TeamComponent({ isCompact: true });

    expect(component.popWidth()).toBeNull();
  });
});
