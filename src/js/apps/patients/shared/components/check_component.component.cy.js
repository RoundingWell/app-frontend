import CheckComponent from './check_component';

context('Check Component', function() {
  specify('requires accessible labels', function() {
    expect(() => new CheckComponent()).to.throw(
      'CheckComponent requires selectLabel and deselectLabel',
    );
  });

  specify('toggles selection and reports the originating event', function() {
    const onSelect = cy.stub();
    const onChange = cy.stub();

    cy
      .mount(() => {
        const component = new CheckComponent({
          deselectLabel: 'Deselect action',
          selectLabel: 'Select action',
          state: { isSelected: false },
        });

        component.on({
          'select': onSelect,
          'change:isSelected': onChange,
        });

        return component;
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
