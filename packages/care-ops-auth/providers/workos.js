import { AuthProvider } from '../AuthProvider.js';

import { createClient } from '@workos-inc/authkit-js';

export class WorkosAuthProvider extends AuthProvider {
  async getToken() {
    if (!this.client) return;
    if (!navigator.onLine && this.token) return this.token;

    return this.client
      .getAccessToken()
      .then(token => {
        this.token = `Bearer ${ token }`;
        return this.token;
      })
      .catch(() => {
        if (!navigator.onLine) return;
        this.logout();
      });
  }

  login(path = AuthProvider.PATH_ROOT) {
    this.client.signIn({ state: path });
  }

  // If considered RW and rwClientId is set
  _getClientId(pathName) {
    const { clientId, rwClientId } = this.config;

    // RWell specific login
    if (rwClientId && (pathName === AuthProvider.PATH_RWELL || localStorage.getItem(AuthProvider.PATH_RWELL))) {
      return rwClientId;
    }

    return clientId;
  }

  async _initClient(clientId, success) {
    const clientConfig = {
      redirectUri: location.origin + AuthProvider.PATH_AUTHD,
      onRedirectCallback: ({ user, state }) => {
        const path = state;
        if (!user) {
          this.loginPrompt(path);
          return;
        }

        this.handleAuthedPath(path);

        success();
      },
      ...this.config.createClientOptions,
    };

    return createClient(clientId, clientConfig);
  }

  async auth(success) {
    this.frameBust();

    if (!navigator.onLine) {
      success();
      return;
    }

    const pathName = location.pathname;

    const clientId = this._getClientId(pathName);

    this.client = await this._initClient(clientId, success);

    // pathName will be PATH_AUTHD here if we are expecting client.onRedirectCallback
    if (pathName === AuthProvider.PATH_AUTHD) return;

    if (pathName === AuthProvider.PATH_LOGOUT) {
      this.token = null;

      try {
        await this.client.signOut({ returnTo: location.origin });
      } finally {
        window.location.replace(AuthProvider.PATH_LOGIN);
      }

      return;
    }

    const isAuthenticated = await this.client.getUser();

    if (!isAuthenticated) {
      this.loginPrompt(pathName);
      return;
    }

    if (pathName === AuthProvider.PATH_LOGIN) {
      this.replaceState(AuthProvider.PATH_ROOT);
    }

    // If we're already authenticated and at the right path
    success();
  }
}
