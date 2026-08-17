import {
  AnnouncementView,
  GuideView,
} from './whats-new_views';

context('What\'s New views', function() {
  specify('renders the announcement and emits both actions', function() {
    const dismiss = cy.stub();
    const showGuide = cy.stub();

    cy.mount(() => {
      const view = new AnnouncementView();

      view.on({
        dismiss,
        'show:guide': showGuide,
      });

      return view;
    });

    cy
      .contains('RoundingWell has a new design.')
      .should('be.visible');

    cy
      .contains('button', 'See what\'s changed.')
      .click()
      .then(() => {
        expect(showGuide).to.be.calledOnce;
      });

    cy
      .get('[aria-label="Dismiss redesign announcement"]')
      .click()
      .then(() => {
        expect(dismiss).to.be.calledOnce;
      });
  });

  specify('renders the guide with two stable release assets', function() {
    cy.mount(() => new GuideView());

    cy
      .get('.whats-new-guide__figure img')
      .should('have.length', 2)
      .first()
      .should('have.attr', 'src', '/images/whats-new/worklist.webp')
      .and('have.attr', 'width', '1240')
      .and('have.attr', 'height', '560');

    cy
      .get('.whats-new-guide__figure img')
      .eq(1)
      .should('have.attr', 'src', '/images/whats-new/action.webp')
      .and('have.attr', 'width', '1240')
      .and('have.attr', 'height', '520');

    cy
      .get('.whats-new-guide__section')
      .should('have.length', 3);

    cy
      .contains('What moved where')
      .should('be.visible');
  });
});
