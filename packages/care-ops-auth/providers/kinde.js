import { AuthProvider } from '../AuthProvider.js';

import createKindeClient from '@kinde-oss/kinde-auth-pkce-js';

export class KindeAuthProvider extends AuthProvider {
  async getToken() {
    if (!this.client) return;
    if (!navigator.onLine && this.token) return this.token;

    return this.client
      .getToken()
      .then(token => {
        this.token = `Bearer ${ token }`;
        return this.token;
      })
      .catch(() => {
        if (!navigator.onLine) return;
        this.logout();
      });
  }

  login(path, connection = this.config.connections.default) {
    this.client.register({
      app_state: { path },
      authUrlParams: { connection_id: connection },
    });
  }

  async _initClient(success) {
    const clientConfig = {
      ...this.config.createParams,
      redirect_uri: location.origin + AuthProvider.PATH_AUTHD,
      logout_uri: location.origin,
      on_redirect_callback: (user, { path } = {}) => {
        if (!user) {
          this.loginPrompt({ appState: path });
          return;
        }

        this.handleAuthedPath(path);

        success();
      },
    };

    return createKindeClient(clientConfig);
  }

  async auth(success) {
    this.frameBust();

    if (!navigator.onLine) {
      success();
      return;
    }

    const pathName = location.pathname;

    this.client = await this._initClient(success);

    if (pathName === AuthProvider.PATH_AUTHD) return;

    if (pathName === AuthProvider.PATH_LOGOUT) {
      this.token = null;
      this.client.logout();
      return;
    }

    // RWell specific login
    if (pathName === AuthProvider.PATH_RWELL || localStorage.getItem(AuthProvider.PATH_RWELL)) {
      this.login(AuthProvider.PATH_RWELL, this.config.connections.roundingwell);
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

    success();
  }
}
