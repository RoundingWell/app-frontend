import { AuthProvider } from '@roundingwell/care-ops-auth/AuthProvider.js';
import { WorkosAuthProvider } from '@roundingwell/care-ops-auth/workos.js';
import { LoginRequiredError } from '@workos-inc/authkit-js';

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get() {
      return value;
    },
  });
}

function mockAccessToken({ iat = Date.now() / 1000, exp = Date.now() / 1000 + 3600 } = {}) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sid: 'session', iat, exp }));

  return `${ header }.${ payload }.signature`;
}

function expectAuthEvent(trackAuthEvent, name, context) {
  const match = trackAuthEvent
    .getCalls()
    .some(call => {
      expect(call.args[0]).to.be.a('string');
      return call.args[0] === name
        && Cypress._.isMatch(call.args[1], context);
    });

  expect(match, `${ name } auth event`).to.be.true;
}

context('WorkosAuthProvider', function() {
  let trackAuthEvent;

  beforeEach(function() {
    setOnline(true);
    trackAuthEvent = cy.stub();
  });

  afterEach(function() {
    document.cookie = 'workos-has-session=; Max-Age=0; path=/';
    localStorage.removeItem('workos:refresh-token:client');
    window.history.pushState({}, '', '/');
    setOnline(true);
  });

  specify('starts re-auth and returns null when token acquisition requires login', function() {
    const error = new LoginRequiredError();
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    provider.token = 'Bearer old-token';
    provider.client = {
      getAccessToken: cy.stub().rejects(error),
      signIn: cy.stub(),
    };
    provider.logout = cy.stub();

    return provider.getToken().then(token => {
      expect(token).to.be.null;
      expect(provider.token).to.be.null;
      expect(provider.client.getAccessToken).to.have.been.calledOnce;
      expect(provider.client.signIn).to.have.been.calledWith({ state: '/' });
      expectAuthEvent(trackAuthEvent, 'AUTH_GET_TOKEN_FAILED', {
        reason: 'login_required',
        error: 'No access token available',
        pathname: '/',
        online: true,
      });
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGIN_PROMPT', {
        reason: 'auth_login_required',
        pathname: '/',
        online: true,
      });
      expect(provider.logout).not.to.have.been.called;
    });
  });

  specify('returns null without prompting for non-login token failures', function() {
    const error = new Error('token failed');
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    provider.token = 'Bearer old-token';
    provider.client = {
      getAccessToken: cy.stub().rejects(error),
      signIn: cy.stub(),
    };

    return provider.getToken().then(token => {
      expect(token).to.be.null;
      expect(provider.token).to.be.null;
      expect(provider.client.signIn).not.to.have.been.called;
      expectAuthEvent(trackAuthEvent, 'AUTH_GET_TOKEN_FAILED', {
        reason: 'get_access_token_failed',
        error: 'token failed',
        pathname: '/',
        online: true,
      });
    });
  });

  specify('does nothing when token acquisition is requested offline', function() {
    setOnline(false);

    const provider = new WorkosAuthProvider();
    provider.client = {
      getAccessToken: cy.stub(),
    };
    provider.logout = cy.stub();

    return provider.getToken().then(token => {
      expect(token).to.be.null;
      expect(provider.client.getAccessToken).not.to.have.been.called;
      expect(provider.logout).not.to.have.been.called;
    });
  });

  specify('coalesces concurrent getToken calls into a single AuthKit request', function() {
    let resolveToken;
    const tokenPromise = new Promise(resolve => {
      resolveToken = resolve;
    });
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    provider.client = {
      getAccessToken: cy.stub().returns(tokenPromise),
    };

    const first = provider.getToken();
    const second = provider.getToken();
    const third = provider.getToken();

    resolveToken('new-token');

    return Promise.all([first, second, third]).then(tokens => {
      expect(tokens).to.deep.equal([
        'Bearer new-token',
        'Bearer new-token',
        'Bearer new-token',
      ]);
      expect(provider.client.getAccessToken).to.have.been.calledOnce;
    });
  });

  specify('clears the in-flight token promise after completion', function() {
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    provider.client = {
      getAccessToken: cy.stub()
        .onFirstCall().resolves('first-token')
        .onSecondCall().resolves('second-token'),
    };

    return provider.getToken()
      .then(() => provider.getToken())
      .then(token => {
        expect(token).to.equal('Bearer second-token');
        expect(provider.client.getAccessToken).to.have.been.calledTwice;
      });
  });

  specify('does not keep retrying normal token reads while re-auth is pending', function() {
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    provider.reauthPending = true;
    provider.client = {
      getAccessToken: cy.stub(),
    };

    return provider.getToken().then(token => {
      expect(token).to.be.null;
      expect(provider.client.getAccessToken).not.to.have.been.called;
    });
  });

  specify('uses AuthKit force refresh for token recovery', function() {
    const provider = new WorkosAuthProvider();
    provider.client = {
      getAccessToken: cy.stub().resolves('new-token'),
    };

    return provider.recoverToken().then(token => {
      expect(token).to.equal('Bearer new-token');
      expect(provider.client.getAccessToken).to.have.been.calledWith({ forceRefresh: true });
    });
  });

  specify('recovers from a 401 and returns the retry response', function() {
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    const retry = cy.stub().resolves({ status: 200 });
    provider.client = {
      getAccessToken: cy.stub().resolves('new-token'),
      signIn: cy.stub(),
    };

    return provider.handleUnauthorized(retry).then(response => {
      expect(response).to.deep.equal({ status: 200 });
      expect(provider.client.getAccessToken).to.have.been.calledWith({ forceRefresh: true });
      expect(retry).to.have.been.calledOnce;
      expect(provider.client.signIn).not.to.have.been.called;
      expectAuthEvent(trackAuthEvent, 'AUTH_401', {
        reason: 'api_unauthorized',
        pathname: '/',
        online: true,
      });
    });
  });

  specify('prompts for login after a recovered retry is still 401', function() {
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    const retry = cy.stub().resolves({ status: 401 });
    provider.client = {
      getAccessToken: cy.stub().resolves('new-token'),
      signIn: cy.stub(),
    };

    return provider.handleUnauthorized(retry).then(response => {
      expect(response).to.deep.equal({ status: 401 });
      expect(retry).to.have.been.calledOnce;
      expect(provider.client.signIn).to.have.been.calledWith({ state: '/' });
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGIN_PROMPT', {
        reason: 'auth_retry_unauthorized',
        pathname: '/',
        online: true,
      });
    });
  });

  specify('does not recover or prompt for a 401 while offline', function() {
    setOnline(false);

    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    const retry = cy.stub();
    provider.client = {
      getAccessToken: cy.stub(),
      signIn: cy.stub(),
    };

    return provider.handleUnauthorized(retry).then(response => {
      expect(response).to.be.undefined;
      expect(provider.client.getAccessToken).not.to.have.been.called;
      expect(retry).not.to.have.been.called;
      expect(provider.client.signIn).not.to.have.been.called;
    });
  });

  specify('coordinates concurrent 401 recovery and prompts only once', function() {
    let resolveRecovery;
    const recoveryPromise = new Promise(resolve => {
      resolveRecovery = resolve;
    });
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    provider.client = {
      getAccessToken: cy.stub().returns(recoveryPromise),
      signIn: cy.stub(),
    };

    const first = provider.handleUnauthorized(cy.stub().resolves({ status: 401 }));
    const second = provider.handleUnauthorized(cy.stub().resolves({ status: 401 }));

    resolveRecovery('new-token');

    return Promise.all([first, second]).then(responses => {
      expect(responses).to.deep.equal([{ status: 401 }, { status: 401 }]);
      expect(provider.client.getAccessToken).to.have.been.calledOnce;
      expect(provider.client.signIn).to.have.been.calledOnce;
    });
  });

  specify('does not keep retrying recovery while re-auth is pending', function() {
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    provider.client = {
      getAccessToken: cy.stub().resolves('new-token'),
      signIn: cy.stub(),
    };

    return provider.handleUnauthorized(cy.stub().resolves({ status: 401 }))
      .then(() => provider.handleUnauthorized(cy.stub().resolves({ status: 401 })))
      .then(() => {
        expect(provider.client.getAccessToken).to.have.been.calledOnce;
        expect(provider.client.signIn).to.have.been.calledOnce;
      });
  });

  specify('falls back to direct sign-in when the login prompt view fails to render', function() {
    function ThrowingLoginView() {
      this.on = () => {};
      this.render = () => {
        throw new TypeError('e.querySelectorAll is not a function');
      };
    }

    const provider = new WorkosAuthProvider({}, ThrowingLoginView, trackAuthEvent);
    provider.client = {
      getAccessToken: cy.stub().rejects(new LoginRequiredError()),
      signIn: cy.stub(),
    };

    return provider.getToken().then(token => {
      expect(token).to.be.null;
      expect(provider.client.signIn).to.have.been.calledWith({ state: '/' });
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGIN_PROMPT_FAILED', {
        reason: 'render_failed',
        error: 'e.querySelectorAll is not a function',
        pathname: '/',
        online: true,
      });
    });
  });

  specify('prompts for login when 401 recovery fails', function() {
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    const retry = cy.stub();
    provider.client = {
      getAccessToken: cy.stub().rejects(new LoginRequiredError()),
      signIn: cy.stub(),
    };

    return provider.handleUnauthorized(retry).then(response => {
      expect(response).to.be.undefined;
      expect(retry).not.to.have.been.called;
      expect(provider.client.signIn).to.have.been.calledWith({ state: '/' });
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGIN_PROMPT', {
        reason: 'auth_recovery_failed',
        pathname: '/',
        online: true,
      });
    });
  });

  specify('prompts for login when 401 recovery runs before client init', function() {
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    const retry = cy.stub();

    return provider.handleUnauthorized(retry).then(response => {
      expect(response).to.be.undefined;
      expect(retry).not.to.have.been.called;
      expect(provider.token).to.be.null;
      expect(provider.reauthPending).to.be.true;
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGIN_PROMPT', {
        reason: 'auth_recovery_failed',
        pathname: '/',
        online: true,
      });
    });
  });

  specify('starts re-auth when AuthKit background refresh fails', function() {
    const now = Date.now() / 1000;
    const provider = new WorkosAuthProvider({
      createClientOptions: {
        apiHostname: location.hostname,
        port: Number(location.port),
        https: false,
        devMode: true,
      },
    }, null, trackAuthEvent);
    let refreshCount = 0;

    localStorage.setItem('workos:refresh-token:client', 'refresh-token');
    cy.intercept('POST', '**/user_management/authenticate', req => {
      refreshCount += 1;
      req.reply(refreshCount === 1 ?
        {
          statusCode: 200,
          body: {
            user: { id: 'user' },
            access_token: mockAccessToken({ iat: now, exp: now }),
            refresh_token: 'refresh-token',
          },
        } :
        {
          statusCode: 400,
          body: {
            error: 'invalid_grant',
            error_description: 'Session has already ended.',
          },
        });
    }).as('authRefresh');

    cy.wrap(provider._initClient('client', cy.stub()))
      .then(client => {
        provider.client = client;
        cy.stub(client, 'signIn').as('signIn');
      });

    cy.wait('@authRefresh');
    cy.wait('@authRefresh');
    cy.get('@signIn').should('have.been.calledWith', { state: '/' });

    cy.then(() => {
      expectAuthEvent(trackAuthEvent, 'AUTH_REFRESH_FAILED', {
        reason: 'refresh_failed',
        pathname: '/',
        online: true,
      });
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGIN_PROMPT', {
        reason: 'auth_refresh_failed',
        pathname: '/',
        online: true,
      });
    });
  });

  specify('signs out directly on /logout with an active session', function() {
    const provider = new WorkosAuthProvider({ clientId: 'client' }, null, trackAuthEvent);
    const client = {
      getUser: cy.stub().returns({ id: 'user' }),
      signIn: cy.stub(),
      signOut: cy.stub(),
    };
    const success = cy.stub();

    provider._initClient = cy.stub().resolves(client);
    window.history.pushState({}, '', AuthProvider.PATH_LOGOUT);

    return provider.auth(success).then(() => {
      expect(client.getUser).to.have.been.calledOnce;
      expect(client.signOut).to.have.been.calledWith({ returnTo: location.origin });
      expect(client.signIn).not.to.have.been.called;
      expect(success).not.to.have.been.called;
    });
  });

  specify('redirects home on /logout without an active session', function() {
    const provider = new WorkosAuthProvider({ clientId: 'client' }, null, trackAuthEvent);
    const client = {
      getUser: cy.stub().returns(null),
      signIn: cy.stub(),
      signOut: cy.stub(),
    };
    const replaceRoot = cy.stub(provider, 'replaceRoot');

    provider._initClient = cy.stub().resolves(client);
    window.history.pushState({}, '', AuthProvider.PATH_LOGOUT);

    return provider.auth(cy.stub()).then(() => {
      expect(client.signIn).not.to.have.been.called;
      expect(client.signOut).not.to.have.been.called;
      expect(replaceRoot).to.have.been.calledOnce;
    });
  });

  specify('starts a logout round trip when /logout has no user but a WorkOS session cookie exists', function() {
    document.cookie = 'workos-has-session=client; path=/';

    const provider = new WorkosAuthProvider({ clientId: 'client' }, null, trackAuthEvent);
    const client = {
      getUser: cy.stub().returns(null),
      signIn: cy.stub(),
      signOut: cy.stub(),
    };
    const replaceRoot = cy.stub(provider, 'replaceRoot');

    provider._initClient = cy.stub().resolves(client);
    window.history.pushState({}, '', AuthProvider.PATH_LOGOUT);

    return provider.auth(cy.stub()).then(() => {
      expect(client.signIn).to.have.been.calledWith({ state: AuthProvider.PATH_LOGOUT });
      expect(client.signOut).not.to.have.been.called;
      expect(replaceRoot).not.to.have.been.called;
    });
  });

  specify('redirects home on /logout when user lookup fails', function() {
    const provider = new WorkosAuthProvider({ clientId: 'client' }, null, trackAuthEvent);
    const client = {
      getUser: cy.stub().throws(new Error('getUser failed')),
      signIn: cy.stub(),
      signOut: cy.stub(),
    };
    const replaceRoot = cy.stub(provider, 'replaceRoot');

    provider._initClient = cy.stub().resolves(client);
    window.history.pushState({}, '', AuthProvider.PATH_LOGOUT);

    return provider.auth(cy.stub()).then(() => {
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGOUT', {
        reason: 'logout_get_user_failed',
        error: 'getUser failed',
        pathname: AuthProvider.PATH_LOGOUT,
        online: true,
      });
      expect(client.signIn).not.to.have.been.called;
      expect(client.signOut).not.to.have.been.called;
      expect(replaceRoot).to.have.been.calledOnce;
    });
  });

  specify('redirects home on /logout when signOut fails after finding a session', function() {
    const provider = new WorkosAuthProvider({ clientId: 'client' }, null, trackAuthEvent);
    const client = {
      getUser: cy.stub().returns({ id: 'user' }),
      signIn: cy.stub(),
      signOut: cy.stub().rejects(new Error('signOut failed')),
    };
    const replaceRoot = cy.stub(provider, 'replaceRoot');

    provider._initClient = cy.stub().resolves(client);
    window.history.pushState({}, '', AuthProvider.PATH_LOGOUT);

    return provider.auth(cy.stub()).then(() => {
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGOUT', {
        reason: 'logout_sign_out_failed',
        error: 'signOut failed',
        pathname: AuthProvider.PATH_LOGOUT,
        online: true,
      });
      expect(client.signIn).not.to.have.been.called;
      expect(replaceRoot).to.have.been.calledOnce;
    });
  });

  specify('explicit logout signs out without redirecting through /logout', function() {
    const provider = new WorkosAuthProvider({}, null, trackAuthEvent);
    provider.token = 'Bearer token';
    provider.client = {
      signOut: cy.stub(),
    };

    return provider.logout().then(() => {
      expect(provider.token).to.be.null;
      expectAuthEvent(trackAuthEvent, 'AUTH_LOGOUT', {
        reason: 'user',
        pathname: '/',
        online: true,
      });
      expect(provider.client.signOut).to.have.been.calledWith({ returnTo: location.origin });
    });
  });
});
