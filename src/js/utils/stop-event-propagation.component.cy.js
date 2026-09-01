import stopEventPropagation from './stop-event-propagation';

context('Stop Event Propagation', function() {
  specify('keeps a child interaction from reaching its row', function() {
    const event = { stopPropagation: cy.stub() };

    stopEventPropagation(event);

    expect(event.stopPropagation).to.have.been.calledOnce;
  });
});
