import { _Model as Interaction } from 'js/entities-service/entities/interactions';

import { getInteractionIcon, getInteractionChannelLabel, getAppointmentStatusLabel, getInteractionDescription, getInteractionSummary, getInteractionViaLabel } from './display';

context('interaction display', function() {
  specify('keeps channel icons and call labels consistent', function() {
    const call = new Interaction({ channel: 'voice', direction: 'inbound' });
    expect(getInteractionIcon(call)).to.equal('phone-arrow-down-left');
    call.set('direction', 'outbound');
    expect(getInteractionIcon(call)).to.equal('phone-arrow-up-right');
    expect(getInteractionChannelLabel(call)).to.equal('Call');
    for (const [channel, icon] of [['sms', 'paper-plane-top'], ['appointment', 'calendar-day'], ['visit', 'hospital']]) {
      expect(getInteractionIcon(new Interaction({ channel }))).to.equal(icon);
    }
    expect(getInteractionChannelLabel(new Interaction({ channel: 'voicemail' }))).to.equal('Voicemail');
    expect(getInteractionChannelLabel(new Interaction({ channel: 'video' }))).to.equal('Video call');
  });

  specify('uses supported appointment labels and cancellation timestamps', function() {
    for (const [status, label] of [['scheduled', 'scheduled'], ['checked_in', 'checked in'], ['completed', 'completed']]) {
      expect(getAppointmentStatusLabel(new Interaction({ metadata: { status } }))).to.equal(label);
    }
    for (const status of ['cancelled', 'unknown', 'toString', 'constructor', undefined]) {
      expect(getAppointmentStatusLabel(new Interaction({ metadata: { status } }))).to.equal(undefined);
    }
    const cancelled = new Interaction({ channel: 'appointment', cancelled_at: '2026-10-08T12:00:00Z', metadata: { status: 'scheduled' } });
    expect(getAppointmentStatusLabel(cancelled)).to.equal('cancelled');
    expect(getInteractionDescription(cancelled)).to.deep.equal({ name: 'Appointment cancelled' });
  });

  specify('preserves inbound and outbound SMS body precedence and note fallbacks', function() {
    const message = new Interaction({ channel: 'sms', direction: 'inbound', metadata: { body: 'Patient reply', message: 'Clinician message', note: 'Fallback note' } });
    expect(getInteractionSummary(message)).to.equal('Patient reply');
    message.set('direction', 'outbound');
    expect(getInteractionSummary(message)).to.equal('Clinician message');
    message.set('metadata', { note: 'Fallback note' });
    expect(getInteractionSummary(message)).to.equal('Fallback note');
    message.set({ channel: 'email', metadata: { message: 'SMS only', note: 'Email note' } });
    expect(getInteractionSummary(message)).to.equal('Email note');
    message.set('channel', 'appointment');
    expect(getInteractionSummary(message)).to.equal(undefined);
  });

  specify('describes senders, direction fallbacks, calls, and visit sources', function() {
    const message = new Interaction({ channel: 'sms', direction: 'inbound', metadata: { from: 'Patient' } });
    expect(getInteractionDescription(message)).to.deep.equal({ name: 'Patient', text: undefined });
    message.set('metadata', {});
    expect(getInteractionDescription(message)).to.deep.equal({ name: undefined, text: 'Inbound Message' });
    message.set('direction', 'outbound');
    expect(getInteractionDescription(message)).to.deep.equal({ name: undefined, text: 'Outbound Message' });
    expect(getInteractionViaLabel(message)).to.equal('via SMS');
    const visit = new Interaction({ channel: 'visit', metadata: { source: 'Hospital' } });
    expect(getInteractionDescription(visit)).to.deep.equal({ name: 'Visit', text: 'added' });
    expect(getInteractionViaLabel(visit)).to.equal('via Hospital');
    const call = new Interaction({ channel: 'voice', metadata: { clinician_name: 'Clinician' } });
    expect(getInteractionDescription(call)).to.deep.equal({ name: 'Clinician', text: 'logged a call.' });
    expect(getInteractionViaLabel(call)).to.equal(undefined);
  });
});
