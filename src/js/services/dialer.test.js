import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

const {
  five9Call,
  five9Init,
  ringcentralCall,
  ringcentralInit,
} = vi.hoisted(() => ({
  five9Call: vi.fn(),
  five9Init: vi.fn(),
  ringcentralCall: vi.fn(),
  ringcentralInit: vi.fn(),
}));

vi.mock('@roundingwell/care-ops-five9', () => ({
  call: five9Call,
  init: five9Init,
}));

vi.mock('@roundingwell/care-ops-ringcentral', () => ({
  call: ringcentralCall,
  init: ringcentralInit,
}));

import DialerService from 'js/services/dialer';

describe('Dialer Service', () => {
  let service;
  let saveArtifact;

  beforeEach(() => {
    saveArtifact = vi.fn();
    Radio.reply('entities', 'save:artifacts:model', saveArtifact);

    service = new DialerService();
    service.getRegion = () => 'overlay-region';
    service.showPatientLinks(null);
  });

  afterEach(() => {
    Radio.channel('entities').reset();
    Radio.channel('settings').reset();
    Radio.channel('bootstrap').reset();
    service.destroy();

    five9Call.mockReset();
    five9Init.mockReset();
    ringcentralCall.mockReset();
    ringcentralInit.mockReset();
  });

  it('saves five9 call artifacts', () => {
    service.five9Call({
      callData: {
        interactionId: 'abc1234',
      },
      callLogData: {
        callDuration: 42,
        disposition: 'completed',
      },
    });

    expect(saveArtifact).toHaveBeenCalledWith({
      artifact: 'five9-call-log',
      identifier: 'abc1234',
      values: {
        callData: {
          interactionId: 'abc1234',
        },
        callLogData: {
          callDuration: 42,
          disposition: 'completed',
        },
      },
    });
  });

  it('saves ringcentral call artifacts', () => {
    service.ringcentralCall({
      callData: {
        callId: 'abc1234',
      },
    });

    expect(saveArtifact).toHaveBeenCalledWith({
      artifact: 'ringcentral-call-log',
      identifier: 'abc1234',
      values: {
        callData: {
          callId: 'abc1234',
        },
      },
    });
  });

  it('initializes the five9 provider once and forwards calls', async() => {
    Radio.reply('settings', 'get', () => 'five9');
    Radio.reply('bootstrap', 'organization', () => ({
      get: () => 'RoundingWell',
    }));

    await service.init();
    await service.init();

    expect(five9Init).toHaveBeenCalledTimes(1);
    expect(five9Init).toHaveBeenCalledWith({
      region: 'overlay-region',
      providerName: 'RoundingWell',
      patients: expect.any(Backbone.Collection),
    });

    service.call('6155555555', 'outbound');
    expect(five9Call).toHaveBeenCalledWith('6155555555', 'outbound');
  });

  it('initializes the ringcentral provider', async() => {
    Radio.reply('settings', 'get', () => 'ringcentral');

    await service.init();

    expect(ringcentralInit).toHaveBeenCalledWith({
      region: 'overlay-region',
      patients: expect.any(Backbone.Collection),
    });
  });

  it('skips provider initialization when no dialer is configured', async() => {
    Radio.reply('settings', 'get', () => null);

    await service.init();

    expect(five9Init).not.toHaveBeenCalled();
    expect(ringcentralInit).not.toHaveBeenCalled();
  });

  it('clears patient links when no call data is provided', () => {
    const patient = new Backbone.Model({
      id: 'patient-1',
      first_name: 'Pat',
      last_name: 'Ient',
    });

    service._addPatient(patient);
    service.showPatientLinks(null);

    expect(five9Init).not.toHaveBeenCalled();
  });

  it('adds the action patient when one exists', () => {
    const patient = new Backbone.Model({
      id: 'patient-1',
      first_name: 'Pat',
      last_name: 'Ient',
    });
    const addPatient = vi.spyOn(service, '_addPatient');

    Radio.reply('entities', 'actions:model', () => ({
      getPatient: () => patient,
    }));

    service.showPatientLinks({
      actionId: 'action-1',
      number: '6155555555',
    });

    expect(addPatient).toHaveBeenCalledWith(patient);
  });

  it('returns early when no action patient or number exists', () => {
    const action = {
      getPatient: () => null,
    };

    const searchCollection = {
      fetch: vi.fn(),
      each: vi.fn(),
    };

    Radio.reply('entities', 'actions:model', () => action);
    Radio.reply('entities', 'searchPatients:collection', () => searchCollection);

    service.showPatientLinks({ actionId: 'action-1' });
    service.showPatientLinks({
      actionId: 'action-1',
      number: 'not-a-phone-number',
    });

    expect(searchCollection.fetch).not.toHaveBeenCalled();
  });

  it('fetches matching patients for a valid number when the action has no patient', async() => {
    const fetchedPatient = new Backbone.Model({
      id: 'patient-2',
      first_name: 'Search',
      last_name: 'Result',
    });

    const searchCollection = {
      fetch: vi.fn().mockResolvedValue(undefined),
      each: vi.fn(callback => callback.call(service, fetchedPatient)),
    };

    Radio.reply('entities', 'actions:model', () => ({
      getPatient: () => null,
    }));
    Radio.reply('entities', 'searchPatients:collection', () => searchCollection);

    service.showPatientLinks({
      actionId: 'action-1',
      number: '6155555555',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(searchCollection.fetch).toHaveBeenCalledWith({
      data: { 'filter[search]': '6155555555' },
    });
    expect(searchCollection.each).toHaveBeenCalled();
  });
});
