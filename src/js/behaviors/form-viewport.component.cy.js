import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import FormViewportBehavior from './form-viewport';

const FormView = View.extend({
  behaviors: {
    viewport: FormViewportBehavior,
  },
  template: hbs`<iframe data-form-viewport-iframe></iframe>`,
});

let formView;

const ParentView = View.extend({
  template: hbs`
    <div data-form-viewport-scroll-container>
      <section data-form-viewport-frame>
        <header data-form-viewport-header><button type="button">Control</button></header>
        <div data-form-region></div>
      </section>
    </div>
  `,
  regions: {
    form: '[data-form-region]',
  },
  onRender() {
    formView = new FormView({
      model: new Backbone.Model({ id: '1' }),
      isExpanded: this.getOption('isExpanded'),
    });
    this.showChildView('form', formView);
  },
});

context('Form Viewport Behavior', function() {
  afterEach(function() {
    Radio.channel('form1').reset();
  });

  specify('uses smooth scrolling when matchMedia has no result', function() {
    cy.mount(() => new ParentView());

    cy.window().then(win => {
      const pane = win.document.querySelector('[data-form-viewport-scroll-container]');
      const scrollTo = cy.stub();
      const [behavior] = formView._behaviors;

      pane.scrollTo = scrollTo;
      pane.scrollTop = 0;
      cy.stub(win, 'matchMedia').returns(undefined);
      cy.stub(pane, 'getBoundingClientRect').returns({ top: 0 });
      cy.stub(behavior.frameEl, 'getBoundingClientRect').returns({ top: 40 });

      Radio.request('form1', 'form:interact');

      expect(scrollTo).to.have.been.calledOnce;
      expect(scrollTo.firstCall.args[0]).to.include({ behavior: 'smooth' });
    });
  });

  specify('responds to viewport state and non-interactive header clicks', function() {
    cy.mount(() => new ParentView());

    cy.window().then(win => {
      const pane = win.document.querySelector('[data-form-viewport-scroll-container]');
      const header = win.document.querySelector('[data-form-viewport-header]');
      const iframe = win.document.querySelector('[data-form-viewport-iframe]');
      const scrollTo = cy.stub(pane, 'scrollTo');
      const [behavior] = formView._behaviors;

      cy.stub(win, 'matchMedia').returns({ matches: true });
      cy.stub(pane, 'getBoundingClientRect').returns({ top: 0 });
      cy.stub(behavior.frameEl, 'getBoundingClientRect').returns({ height: 80, top: 40 });
      cy.stub(iframe, 'getBoundingClientRect').returns({ height: 40 });

      header.querySelector('button').click();
      expect(scrollTo).not.to.have.been.called;

      header.click();
      expect(scrollTo).to.have.been.calledOnce;
      expect(scrollTo.firstCall.args[0]).to.include({ behavior: 'auto' });

      formView.trigger('change:expanded', true);

      Radio.request('form1', 'form:interact');
      expect(scrollTo).to.have.been.calledOnce;

      formView.trigger('change:expanded', true);
      formView.trigger('change:expanded', false);
      behavior.scheduleFrameSizing();
      behavior.clearScheduledSizing();
    });
  });

  specify('observes resize targets and enforces its required DOM contract', function() {
    cy.window().then(win => {
      const observe = cy.stub();
      const disconnect = cy.stub();

      cy.stub(win, 'ResizeObserver').callsFake(function(callback) {
        this.callback = callback;
        this.observe = observe;
        this.disconnect = disconnect;
      });
    });

    cy.mount(() => new ParentView());

    cy.then(() => {
      const [behavior] = formView._behaviors;

      expect(behavior.resizeObserver).to.exist;
      expect(behavior.resizeObserver.observe).to.have.been.calledTwice;
      expect(() => behavior.getRequiredClosest('missing frame', '.missing')).to.throw(
        'FormViewportBehavior requires a missing frame matching .missing',
      );
      expect(() => behavior.getRequiredElement('missing iframe', formView.el, '.missing')).to.throw(
        'FormViewportBehavior requires a missing iframe matching .missing',
      );

      behavior.resizeObserver.callback();
    });
  });

  specify('works without ResizeObserver support', function() {
    cy.window().then(win => {
      cy.stub(win, 'ResizeObserver').value(undefined);
    });

    cy.mount(() => new ParentView());

    cy.then(() => {
      const [behavior] = formView._behaviors;
      expect(behavior.resizeObserver).to.equal(undefined);
    });
  });
});
