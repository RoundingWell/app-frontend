import CheckView from './check_view';

context('Check View', function() {
  specify('toggles selection and reports the originating event', function() {
    const onSelect = cy.stub();
    const onChange = cy.stub();

    cy
      .mount(() => {
        const view = new CheckView({
          deselectLabel: 'Deselect action',
          selectLabel: 'Select action',
          isSelected: false,
        });

        view.on({
          'select': onSelect,
          'change:isSelected': onChange,
        });

        return view;
      })
      .as('root');

    cy
      .get('@root')
      .find('[role="checkbox"]')
      .should('have.attr', 'aria-checked', 'false')
      .and('have.attr', 'aria-label', 'Select action')
      .click();

    cy
      .get('@root')
      .find('[role="checkbox"]')
      .should('have.attr', 'aria-checked', 'true')
      .and('have.attr', 'aria-label', 'Deselect action')
      .then(() => {
        expect(onSelect).to.be.calledOnce;
        expect(onChange).to.be.calledOnceWith(true);
      });
  });
});
