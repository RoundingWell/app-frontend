import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Radio from 'backbone.radio';

import { Collection as States } from 'js/entities-service/entities/states';

import StateComponent from 'js/views/patients/shared/components/state_component';

import statesFixture from 'fixtures/test/states.json';

const stateTodo = statesFixture.find(({ slug }) => slug === 'to-do');
const stateInProgress = statesFixture.find(({ slug }) => slug === 'in-progress');
const stateDone = statesFixture.find(({ slug }) => slug === 'done');

describe('State Component', () => {
  let firstStates;
  let secondStates;
  let firstWorkspace;
  let secondWorkspace;

  beforeEach(() => {
    firstStates = new States(statesFixture);
    secondStates = new States(statesFixture);

    secondStates.remove(stateDone.id);

    firstWorkspace = {
      getStates: () => firstStates,
    };

    secondWorkspace = {
      getStates: () => secondStates,
    };
  });

  afterEach(() => {
    Radio.reset('workspace');
    Radio.reset('entities');
  });

  it('builds grouped state lists and selects the initial state', () => {
    Radio.reply('workspace', 'current', () => firstWorkspace);
    Radio.reply('entities', 'states:collection', items => new States(items));

    const component = new StateComponent({ stateId: stateInProgress.id });

    expect(component.getState('selected')?.id).toBe(stateInProgress.id);
    expect(component.lists).toHaveLength(3);
    expect(component.lists.map(({ headingText }) => headingText)).toEqual(['Queued', 'Started', 'Done']);
    expect(component.lists[0].collection.pluck('id')).toEqual([stateTodo.id]);
    expect(component.lists[1].collection.pluck('id')).toEqual([stateInProgress.id]);
    expect(component.lists[2].collection.pluck('id')).toEqual([stateDone.id, statesFixture[3].id, statesFixture[4].id]);
  });

  it('uses compact button options when requested', () => {
    Radio.reply('workspace', 'current', () => firstWorkspace);
    Radio.reply('entities', 'states:collection', items => new States(items));

    const component = new StateComponent({ isCompact: true, stateId: stateInProgress.id });

    expect(component.viewOptions()).toEqual({
      className: 'button-secondary--compact',
      template: component.viewOptions().template,
      templateContext: {
        isCompact: true,
      },
    });
  });

  it('uses full-width button options and pop width when not compact', () => {
    Radio.reply('workspace', 'current', () => firstWorkspace);
    Radio.reply('entities', 'states:collection', items => new States(items));

    const component = new StateComponent({ stateId: stateInProgress.id });

    component.getView = () => ({
      $el: {
        outerWidth: () => 320,
      },
    });

    expect(component.popWidth()).toBe(320);
    expect(component.viewOptions()).toEqual({
      className: 'button-secondary w-100',
      template: component.viewOptions().template,
      templateContext: {
        isCompact: false,
      },
    });
    expect(component.picklistOptions.headingText).toBe('Update State');
  });

  it('emits change:state when the selection changes', () => {
    Radio.reply('workspace', 'current', () => firstWorkspace);
    Radio.reply('entities', 'states:collection', items => new States(items));

    const changeState = vi.fn();
    const component = new StateComponent({ stateId: stateInProgress.id });

    component.on('change:state', changeState);
    component.onChangeSelected(firstStates.get(stateDone.id));

    expect(changeState).toHaveBeenCalledWith(firstStates.get(stateDone.id));
  });

  it('invalidates cached state lists when the workspace changes', () => {
    let currentWorkspace = firstWorkspace;

    Radio.reply('workspace', 'current', () => currentWorkspace);
    Radio.reply('entities', 'states:collection', items => new States(items));

    const firstComponent = new StateComponent({ stateId: stateInProgress.id });
    expect(firstComponent.lists[2].collection.get(stateDone.id)).toBeDefined();

    currentWorkspace = secondWorkspace;

    const secondComponent = new StateComponent({ stateId: stateInProgress.id });
    expect(secondComponent.lists[2].collection.get(stateDone.id)).toBeUndefined();
  });

  it('keeps cached state lists for the same workspace and can clear the selection', () => {
    Radio.reply('workspace', 'current', () => firstWorkspace);
    Radio.reply('entities', 'states:collection', items => new States(items));

    const firstComponent = new StateComponent({ stateId: stateInProgress.id });
    const secondComponent = new StateComponent({ stateId: stateTodo.id, isCompact: true });

    expect(secondComponent.lists).toBe(firstComponent.lists);
    expect(secondComponent.popWidth()).toBeNull();

    secondComponent.show = vi.fn();
    secondComponent.setSelected(null);

    expect(secondComponent.show).toHaveBeenCalled();
    expect(secondComponent.getState('selected')).toBeUndefined();
  });
});
