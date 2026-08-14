import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import PreloadRegion from './preload_region';

const LoadingHostView = View.extend({
  template: hbs`<div data-loading-region></div>`,
  regions: {
    loading: {
      el: '[data-loading-region]',
      regionClass: PreloadRegion,
    },
  },
  onRender() {
    this.getRegion('loading').startPreloader();
  },
});

const ImmediateLoadingHostView = LoadingHostView.extend({
  regions: {
    loading: {
      el: '[data-loading-region]',
      regionClass: PreloadRegion.extend({ timeout: 0 }),
    },
  },
});

const GenericLoadingHostView = View.extend({
  template: hbs`<div data-loading-region></div>`,
  regions: {
    loading: {
      el: '[data-loading-region]',
      regionClass: PreloadRegion,
    },
  },
  onRender() {
    this.getRegion('loading').startPreloader({ variant: 'generic' });
  },
});

context('PreloadRegion', function() {
  specify('renders a short, fading skeleton stack', function() {
    cy
      .mount(() => new LoadingHostView())
      .get('.loader')
      .should('have.attr', 'aria-busy', 'true')
      .should('have.attr', 'role', 'status')
      .find('.loader__skeleton-item')
      .should('have.length', 3);
  });

  specify('supports immediate loaders', function() {
    cy
      .mount(() => new ImmediateLoadingHostView())
      .get('.loader .skeleton-loading--immediate')
      .should('exist');
  });

  specify('renders a neutral indicator for generic loading states', function() {
    cy
      .mount(() => new GenericLoadingHostView())
      .get('.loader__indicator.skeleton-loading--generic')
      .find('.loader__indicator-dot')
      .should('have.length', 3);

    cy
      .get('.loader__indicator')
      .should('be.visible');

    cy.get('.loader__skeleton').should('not.exist');
  });
});
