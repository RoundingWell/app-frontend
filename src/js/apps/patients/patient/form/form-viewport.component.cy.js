import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { Region, View } from 'marionette';

import FormViewportBehavior from './form-viewport';

let formView;
let iframeView;
let viewportView;

const IframeView = View.extend({
  ui: {
    iframe: 'iframe',
  },
  template: hbs`<iframe></iframe>`,
  getViewportElement() {
    return this.ui.iframe[0];
  },
  getViewportHeight() {
    return this.getViewportElement().getBoundingClientRect().height;
  },
  setViewportHeight(height) {
    this.getViewportElement().style.height = `${ height }px`;
  },
  clearViewportHeight() {
    this.getViewportElement().style.removeProperty('height');
  },
});

const FormView = View.extend({
  behaviors: [FormViewportBehavior],
  template: hbs`
    <header data-form-viewport-header>
      <div class="form__header-title">Title</div>
      <button type="button">Control</button>
    </header>
    <div data-widgets-header-region></div>
    <div data-form-region></div>
  `,
  regions: {
    form: '[data-form-region]',
    widgets: {
      el: '[data-widgets-header-region]',
      regionClass: Region.extend({ replaceElement: true }),
    },
  },
  ui: {
    viewportInteract: '.form__header-title',
  },
  triggers: {
    'click @ui.viewportInteract': 'form:interact',
  },
  onRender() {
    this.showIframe();
  },
  showIframe() {
    iframeView = new IframeView();
    this.showChildView('form', iframeView);
    this.trigger('change:form:view');
  },
  showWidgets() {
    this.showChildView('widgets', new View({
      className: 'test-widgets',
      template: hbs`Widgets`,
    }));
  },
  setExpanded(isExpanded) {
    this.trigger('change:expanded', !!isExpanded);
  },
});

const ViewportView = View.extend({
  template: hbs`<div data-form-region></div>`,
  regions: {
    form: '[data-form-region]',
  },
  onRender() {
    viewportView = this;
    formView = new FormView({
      model: new Backbone.Model({ id: '1' }),
      viewportView: this,
      isExpanded: this.getOption('isExpanded'),
    });
    this.showChildView('form', formView);
  },
  getViewportElement() {
    return this.el;
  },
  getViewportMetrics() {
    return {
      height: this.el.clientHeight,
      scrollTop: this.el.scrollTop,
      top: this.el.getBoundingClientRect().top,
    };
  },
  scrollViewportTo(options) {
    this.el.scrollTo(options);
  },
});

context('Form Viewport Behavior', function() {
  afterEach(function() {
    Radio.channel('form1').reset();
  });

  specify('uses smooth scrolling when matchMedia has no result', function() {
    cy.mount(() => new ViewportView());

    cy.window().then(win => {
      const scrollViewportTo = cy.stub(viewportView, 'scrollViewportTo');

      cy.stub(win, 'matchMedia').returns(undefined);
      cy.stub(viewportView, 'getViewportMetrics').returns({
        height: 200,
        scrollTop: 0,
        top: 0,
      });
      cy.stub(formView.el, 'getBoundingClientRect').returns({ height: 80, top: 40 });

      Radio.request('form1', 'form:interact');

      expect(scrollViewportTo).to.have.been.calledOnce;
      expect(scrollViewportTo.firstCall.args[0]).to.include({ behavior: 'smooth' });
    });
  });

  specify('responds to viewport state and semantic header triggers', function() {
    cy.mount(() => new ViewportView());

    cy.window().then(win => {
      const header = formView.el.querySelector('[data-form-viewport-header]');
      const headerTitle = header.querySelector('.form__header-title');
      const scrollViewportTo = cy.stub(viewportView, 'scrollViewportTo');

      cy.stub(win, 'matchMedia').returns({ matches: true });
      cy.stub(viewportView, 'getViewportMetrics').returns({
        height: 200,
        scrollTop: 0,
        top: 0,
      });
      cy.stub(formView.el, 'getBoundingClientRect').returns({ height: 80, top: 40 });

      header.querySelector('button').click();
      expect(scrollViewportTo).not.to.have.been.called;

      headerTitle.click();
      expect(scrollViewportTo).to.have.been.calledOnce;
      expect(scrollViewportTo.firstCall.args[0]).to.include({ behavior: 'auto' });

      formView.setExpanded(true);

      Radio.request('form1', 'form:interact');
      expect(scrollViewportTo).to.have.been.calledOnce;

      formView.setExpanded(true);
      formView.setExpanded(false);
      const [behavior] = formView._behaviors;
      Radio.trigger('user-activity', 'window:resize');
      expect(behavior.frameSizingFrame).to.be.a('number');
      behavior.clearScheduledSizing();
    });
  });

  specify('keeps the embedded form at a usable minimum height', function() {
    cy.mount(() => new ViewportView());

    cy.then(() => {
      const [behavior] = formView._behaviors;

      cy.stub(viewportView, 'getViewportMetrics').returns({
        height: 200,
        scrollTop: 0,
        top: 0,
      });
      cy.stub(formView.el, 'getBoundingClientRect').returns({ height: 100, top: 0 });
      cy.stub(iframeView, 'getViewportHeight').returns(50);

      behavior.applyFrameSizing();

      expect(iframeView.getViewportElement().style.height).to.equal('320px');
    });
  });

  specify('observes owner view elements and refreshes when the iframe view changes', function() {
    cy.window().then(win => {
      const observe = cy.stub();
      const disconnect = cy.stub();

      cy.stub(win, 'ResizeObserver').callsFake(function(callback) {
        this.callback = callback;
        this.observe = observe;
        this.disconnect = disconnect;
      });
    });

    cy.mount(() => new ViewportView());

    cy.then(() => {
      const [behavior] = formView._behaviors;
      const firstIframeElement = iframeView.getViewportElement();

      expect(behavior.resizeObserver).to.exist;
      expect(behavior.resizeObserver.observe).to.have.been.calledThrice;
      expect(behavior.resizeObserver.observe).to.have.been.calledWith(viewportView.el);
      expect(behavior.resizeObserver.observe).to.have.been.calledWith(
        formView.el.querySelector('[data-form-viewport-header]'),
      );
      expect(behavior.resizeObserver.observe).to.have.been.calledWith(
        formView.el.querySelector('[data-widgets-header-region]'),
      );

      behavior.resizeObserver.observe.resetHistory();
      behavior.resizeObserver.disconnect.resetHistory();
      formView.showWidgets();

      expect(behavior.resizeObserver.disconnect).to.have.been.calledOnce;
      expect(behavior.resizeObserver.observe).to.have.been.calledThrice;
      expect(behavior.resizeObserver.observe).to.have.been.calledWith(
        formView.getChildView('widgets').el,
      );

      behavior.resizeObserver.disconnect.resetHistory();
      expect(behavior.resizeObserver.disconnect).not.to.have.been.called;
      formView.showIframe();

      expect(behavior.resizeObserver.disconnect).to.have.been.calledOnce;
      expect(iframeView.getViewportElement()).not.to.equal(firstIframeElement);
      expect(iframeView.getViewportElement().style.height).not.to.equal('');

      behavior.resizeObserver.callback();
    });
  });

  specify('requires an explicit viewport owner', function() {
    expect(() => new FormView({
      model: new Backbone.Model({ id: '1' }),
    })).to.throw('FormViewportBehavior requires a viewport view');
  });

  specify('works without ResizeObserver support', function() {
    cy.window().then(win => {
      cy.stub(win, 'ResizeObserver').value(undefined);
    });

    cy.mount(() => new ViewportView());

    cy.then(() => {
      const [behavior] = formView._behaviors;
      expect(behavior.resizeObserver).to.equal(undefined);
    });
  });
});
