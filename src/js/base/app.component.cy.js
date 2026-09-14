import hbs from 'handlebars-inline-precompile';
import { Region, View } from 'marionette';

import App from './app';

const LayoutView = View.extend({
  template: hbs`<header></header><main></main>`,
  regions: {
    header: 'header',
    content: 'main',
  },
});

function createApp() {
  const host = document.createElement('section');
  document.body.append(host);

  return {
    app: new App({ region: { el: host } }),
    host,
  };
}

context('Application prepared root View', function() {
  let app;
  let host;

  afterEach(function() {
    host?.remove();
    return app?.destroy();
  });

  specify('composes detached children and preserves content across a header update', function() {
    ({ app, host } = createApp());
    const root = new LayoutView();
    const firstHeader = new View({ template: hbs`Header` });
    const content = new View({ template: hbs`<input aria-label="Draft" value="Initial">` });
    const attachments = [];
    let renderCount = 0;

    root.on('render', () => renderCount++);

    root.on('attach', () => {
      attachments.push([
        root.el.isConnected,
        root.getChildView('header').el.isConnected,
        root.getChildView('content').el.isConnected,
      ]);
    });

    app.setView(root);
    app.getView().showChildView('header', firstHeader);
    app.getView().showChildView('content', content);

    expect(app.getView()).to.equal(root);
    expect(app.getRegion().currentView).to.be.undefined;
    expect(root.el.isConnected).to.equal(false);
    expect(firstHeader.isAttached()).to.equal(false);
    expect(content.isAttached()).to.equal(false);
    expect(host.childElementCount).to.equal(0);

    app.showView();

    expect(attachments).to.deep.equal([[true, true, true]]);
    expect(app.getRegion().currentView).to.equal(root);

    const input = content.el.querySelector('input');
    input.focus();
    input.value = 'Edited draft';

    const replacementHeader = new View({ template: hbs`Updated header` });
    app.getView().showChildView('header', replacementHeader);

    expect(firstHeader.isDestroyed()).to.equal(true);
    expect(root.getChildView('content')).to.equal(content);
    expect(content.el.querySelector('input')).to.equal(input);
    expect(document.activeElement).to.equal(input);
    expect(input.value).to.equal('Edited draft');
    expect(replacementHeader.isAttached()).to.equal(true);

    app.showView();

    expect(attachments).to.have.length(1);
    expect(renderCount).to.equal(1);
    expect(app.getView()).to.equal(root);
  });

  specify('preserves the displayed tree until a prepared replacement is shown', function() {
    ({ app, host } = createApp());
    const displayed = new View({
      template: hbs`<input aria-label="Current draft" value="Initial">`,
    });

    app.showView(displayed);
    const input = displayed.el.querySelector('input');
    input.focus();
    input.value = 'Unsaved edit';

    const prepared = new LayoutView();
    app.setView(prepared);
    prepared.render();

    expect(app.getView()).to.equal(prepared);
    expect(app.getRegion().currentView).to.equal(displayed);
    expect(prepared.el.isConnected).to.equal(false);
    expect(displayed.el.isConnected).to.equal(true);
    expect(displayed.isDestroyed()).to.equal(false);
    expect(document.activeElement).to.equal(input);
    expect(input.value).to.equal('Unsaved edit');

    app.showView();

    expect(displayed.isDestroyed()).to.equal(true);
    expect(app.getView()).to.equal(prepared);
    expect(app.getRegion().currentView).to.equal(prepared);
    expect(prepared.el.isConnected).to.equal(true);
  });

  function destroysPreparedTree(operation) {
    return function() {
      ({ app, host } = createApp());
      const displayed = new View({ template: hbs`Displayed` });
      const root = new LayoutView();
      const child = new View({ template: false });
      const replacement = new LayoutView();

      app.showView(displayed);
      app.setView(root);
      root.showChildView('header', child);
      app.setView(replacement);

      expect(root.isDestroyed()).to.equal(true);
      expect(child.isDestroyed()).to.equal(true);
      expect(displayed.isDestroyed()).to.equal(false);
      expect(app.getRegion().currentView).to.equal(displayed);
      expect(app.getView()).to.equal(replacement);

      return app[operation]().then(() => {
        expect(displayed.isDestroyed()).to.equal(true);
        expect(replacement.isDestroyed()).to.equal(true);
        expect(app.getView()).to.be.undefined;
        expect(host.childElementCount).to.equal(0);
      });
    };
  }

  specify('stop destroys a prepared tree before display', destroysPreparedTree('stop'));

  specify('restart destroys a prepared tree before display', destroysPreparedTree('restart'));

  specify('destroy destroys a prepared tree before display', destroysPreparedTree('destroy'));

  specify('selecting the displayed root cancels its prepared replacement', function() {
    ({ app, host } = createApp());
    const displayed = new View({ template: hbs`Displayed` });
    const prepared = new LayoutView();

    app.showView(displayed);
    app.setView(prepared);
    app.setView(displayed);

    expect(prepared.isDestroyed()).to.equal(true);
    expect(displayed.isDestroyed()).to.equal(false);
    expect(displayed.isAttached()).to.equal(true);
    expect(app.getView()).to.equal(displayed);
    expect(app.getRegion().currentView).to.equal(displayed);
  });

  specify('releases roots destroyed or detached outside the Application', function() {
    ({ app, host } = createApp());
    const displayed = new LayoutView();
    const prepared = new LayoutView();

    app.showView(displayed);
    app.setView(prepared);
    prepared.destroy();
    expect(app.getView()).to.equal(displayed);

    expect(app.getRegion().detachView()).to.equal(displayed);
    expect(app.getView()).to.be.undefined;

    const external = new View({ template: false });
    app.getRegion().show(external);
    expect(app.getView()).to.equal(external);

    const otherRegion = new Region({ el: document.createElement('section') });
    app.setView(displayed);
    expect(() => otherRegion.show(displayed)).to.throw().and.have.property('code', 'MN0003');
    otherRegion.destroy();
  });
});
