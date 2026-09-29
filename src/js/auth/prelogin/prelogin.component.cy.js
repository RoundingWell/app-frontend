import { LoginPromptView } from './prelogin_views';

context('Login prompt', function() {
  let view;

  afterEach(function() {
    view?.destroy();
  });

  // The E2E auth provider bypasses this pre-authentication screen.
  specify('mounts in the auth root and forwards the sign-in action', function() {
    cy.document().then(document => {
      const root = document.createElement('div');
      root.id = 'root';
      document.body.append(root);
      view = new LoginPromptView();
      view.on('click:login', cy.stub().as('login'));
      view.render();
    });
    cy.contains('Continue to sign in').click();
    cy.get('@login').should('have.been.calledOnce');
  });
});
