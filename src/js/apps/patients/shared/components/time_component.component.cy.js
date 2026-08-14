import TimeComponent from './time_component';

function mountTime(options, onChange) {
  return cy.mount(rootView => {
    TimeComponent.setPopRegion(rootView.getRegion('pop'));

    const component = new TimeComponent(options);

    if (onChange) component.on('change:time', onChange);

    return component;
  });
}

context('Time Component', function() {
  specify('selects and clears a time', function() {
    const onChange = cy.stub();

    mountTime({
      isCompact: false,
      time: null,
    }, onChange)
      .as('root');

    cy
      .get('@root')
      .contains('Time')
      .click();

    cy
      .get('.picklist')
      .contains('7:00 AM')
      .click()
      .then(() => {
        expect(onChange)
          .to.be.calledOnce
          .and.calledWith('07:00:00');
      });

    cy
      .get('@root')
      .contains('7:00 AM')
      .click();

    cy
      .get('.picklist .js-clear')
      .click()
      .then(() => {
        expect(onChange)
          .to.be.calledTwice;
        expect(onChange.secondCall)
          .to.be.calledWith(null);
      });

    cy
      .get('@root')
      .contains('Time');
  });

  specify('renders a custom time without selecting it', function() {
    mountTime({
      isCompact: false,
      time: '12:31:00',
    }).as('root');

    cy
      .get('@root')
      .contains('12:31 PM');
  });

  specify('renders an empty compact control', function() {
    mountTime({
      isCompact: true,
      time: null,
    }).as('root');

    cy
      .get('@root')
      .find('[aria-haspopup="listbox"]')
      .should('have.attr', 'aria-expanded', 'false');
  });
});
