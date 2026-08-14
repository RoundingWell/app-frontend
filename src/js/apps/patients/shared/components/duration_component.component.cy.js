import DurationComponent from './duration_component';

context('Duration Component', function() {
  specify('selects and clears a duration', function() {
    const onChange = cy.stub();

    cy
      .mount(rootView => {
        DurationComponent.setPopRegion(rootView.getRegion('pop'));

        const component = new DurationComponent({
          duration: null,
          isCompact: false,
        });

        component.on('change:duration', onChange);

        return component;
      })
      .as('root');

    cy
      .get('@root')
      .contains('Select Duration')
      .click();

    cy
      .get('.picklist')
      .contains('5 mins')
      .click()
      .then(() => {
        expect(onChange).to.be.calledWith(5);
      });

    cy
      .get('@root')
      .contains('5 mins')
      .click();

    cy
      .get('.picklist .js-clear')
      .click()
      .then(() => {
        expect(onChange).to.be.calledWith(0);
      });
  });
});
