import {
  AnnouncementView,
  DesignUpdateView,
  WHATS_NEW_URL,
} from './whats-new_views';

context('What\'s New views', function() {
  specify('renders the announcement and emits both actions', function() {
    const dismiss = cy.stub();
    const showUpdate = cy.stub();

    cy.mount(() => {
      const view = new AnnouncementView();

      view.on({
        dismiss,
        'show:update': showUpdate,
      });

      return view;
    });

    cy
      .contains('RW Design Update')
      .should('be.visible');

    cy
      .contains('button', 'See what\'s new')
      .as('updateButton')
      .find('use')
      .should('have.attr', 'href', '#far-fa-chevron-right');

    cy
      .get('symbol#far-fa-chevron-right')
      .should('exist');

    cy
      .get('@updateButton')
      .click()
      .then(() => {
        expect(showUpdate).to.be.calledOnce;
      });

    cy
      .get('[aria-label="Dismiss design update announcement"]')
      .click()
      .then(() => {
        expect(dismiss).to.be.calledOnce;
      });
  });

  specify('renders the design update iframe', function() {
    cy.mount(() => new DesignUpdateView());

    cy
      .get('iframe')
      .should('have.attr', 'src', WHATS_NEW_URL)
      .and('have.attr', 'title', 'What\'s New');
  });
});
