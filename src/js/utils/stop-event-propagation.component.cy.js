import stopEventPropagation from './stop-event-propagation';

context('Stop Event Propagation', function() {
  specify('keeps a child interaction from reaching its row', function() {
    const event = { stopImmediatePropagation: cy.stub() };

    stopEventPropagation(event);

    expect(event.stopImmediatePropagation).to.have.been.calledOnce;
  });
});
