import { AuthProvider } from './AuthProvider.js';

import { createAuth0Client } from '@auth0/auth0-spa-js';

const RWELL_CONNECTION = 'google-oauth2';

export class Auth0hAuthProvider extends AuthProvider {
  async getToken() {
    if (!this.client) return;
    if (!navigator.onLine) return this.token;

    return this.client
      .getTokenSilently()
      .then(token => {
        this.token = `Bearer ${ token }`;
        return this.token;
      })
      .catch(() => {
        if (!navigator.onLine) return;
        this.logout();
      });
  }

  login(opts) {
    this.client.loginWithRedirect({ prompt: 'login', ...opts });
  }

  async _authenticate() {
    try {
      const { appState } = await this.client.handleRedirectCallback();
      this.handleAuthedPath(appState);
    } catch {
      this.loginPrompt();
    }
  }

  async _initClient() {
    const clientConfig = {
      ...this.config,
      authorizationParams: {
        redirect_uri: location.origin + AuthProvider.PATH_AUTHD,
        audience: 'care-ops-backend',
        ...this.config.authorizationParams,
      },
    };

    if (localStorage.getItem(AuthProvider.PATH_RWELL)) {
      clientConfig.authorizationParams.connection = RWELL_CONNECTION;
    }

    this.client = await createAuth0Client(clientConfig);
  }

  async auth() {
    this.frameBust();

    if (!navigator.onLine) return;

    const appState = location.pathname;

    await this._initClient();

    if (appState === AuthProvider.PATH_AUTHD) {
      await this._authenticate();
      return;
    }

    if (appState === AuthProvider.PATH_LOGOUT) {
      this.token = null;
      this.client.logout({ logoutParams: { returnTo: location.origin } });
      return;
    }

    // RWell specific login
    if (appState === AuthProvider.PATH_RWELL) {
      this.login({
        appState,
        authorizationParams: { connection: RWELL_CONNECTION },
      });
      return;
    }

    const isAuthenticated = await this.client.isAuthenticated();

    if (!isAuthenticated) {
      this.loginPrompt({ appState });
      return;
    }

    if (appState === AuthProvider.PATH_LOGIN) {
      this.replaceState(AuthProvider.PATH_ROOT);
    }
  }
}
