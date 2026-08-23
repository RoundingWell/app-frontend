import Backbone from 'backbone';

import { IframeView } from './dashboard_views';

context('Dashboard IframeView', function() {
  specify('iframes a Lightdash embed URL instead of using the QuickSight SDK', function() {
    const embedUrl = 'https://lightdash.example.com/embed/71de5075-9101-4620-8338-55bf3bdde5ef#header.payload.signature';

    cy
      .mount(() => {
        return new IframeView({
          model: new Backbone.Model({
            name: 'Care Ops',
            embed_url: embedUrl,
          }),
        });
      })
      .as('root');

    cy
      .get('@root')
      .find('iframe')
      .should('have.length', 1)
      .and('have.attr', 'src', embedUrl)
      .and('have.attr', 'title', 'Care Ops')
      .and('have.attr', 'sandbox', 'allow-scripts allow-same-origin allow-forms allow-downloads');
  });
});
