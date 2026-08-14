import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import $ from 'jquery';
import { View } from 'marionette';

import IframeFormBehavior from './iframe-form';

const IframeView = View.extend({
  behaviors: [IframeFormBehavior],
  template: hbs`<iframe></iframe>`,
});

const ParentView = View.extend({
  template: hbs`
    <div data-first-region></div>
    <div data-second-region></div>
  `,
  regions: {
    first: '[data-first-region]',
    second: '[data-second-region]',
  },
  onRender() {
    this.showChildView('first', new IframeView({
      model: new Backbone.Model({ id: '1' }),
    }));
    this.showChildView('second', new IframeView({
      model: new Backbone.Model({ id: '2' }),
    }));
  },
});

context('Iframe Form Behavior', function() {
  afterEach(function() {
    Radio.channel('form1').reset();
    Radio.channel('form2').reset();
    Radio.channel('user-activity').reset();
  });

  specify('routes postMessage events only to the matching iframe channel', function() {
    const requests = [];

    Radio.reply('form1', 'fetch:form:data', (...args) => requests.push(['form1', ...args]));
    Radio.reply('form2', 'fetch:form:data', (...args) => requests.push(['form2', ...args]));

    cy
      .mount(() => new ParentView())
      .get('iframe')
      .should('have.length', 2);

    cy.window().then(win => {
      const [firstIframe, secondIframe] = win.document.querySelectorAll('iframe');

      $(win).trigger($.Event('message', {
        originalEvent: {
          data: {
            message: 'fetch:form:data',
            args: { patientId: 'patient-1' },
            requestId: 'req_1',
          },
          origin: win.origin,
          source: firstIframe.contentWindow,
        },
      }));

      expect(requests).to.deep.equal([
        ['form1', { patientId: 'patient-1' }, 'req_1'],
      ]);

      requests.length = 0;

      $(win).trigger($.Event('message', {
        originalEvent: {
          data: {
            message: 'fetch:form:data',
            args: { patientId: 'patient-2' },
            requestId: 'req_2',
          },
          origin: win.origin,
          source: secondIframe.contentWindow,
        },
      }));

      expect(requests).to.deep.equal([
        ['form2', { patientId: 'patient-2' }, 'req_2'],
      ]);
    });
  });

  specify('reports iframe interactions as user activity', function() {
    const focusedIframes = [];

    Radio.channel('user-activity').on('iframe:focus', iframe => focusedIframes.push(iframe));

    cy
      .mount(() => new ParentView())
      .get('iframe')
      .should('have.length', 2);

    cy.window().then(win => {
      const [firstIframe] = win.document.querySelectorAll('iframe');

      $(win).trigger($.Event('message', {
        originalEvent: {
          data: { message: 'form:interact' },
          origin: win.origin,
          source: firstIframe.contentWindow,
        },
      }));

      expect(focusedIframes).to.deep.equal([firstIframe]);
    });
  });
});
