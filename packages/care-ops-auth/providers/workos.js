import { AuthProvider } from '../AuthProvider.js';

import { createClient, LoginRequiredError } from '@workos-inc/authkit-js';

function hasWorkosSessionCookie(clientId) {
  // Mirrors AuthKit's internal hasSessionCookie() check; no public helper is exported.
  const match = document.cookie.match(/(?:^|;\s*)workos-has-session=([^;]*)/);
  if (!match) return false;

  const cookieValue = match[1];
  return cookieValue === '1' ? true : cookieValue.split('.').includes(clientId);
}

export class WorkosAuthProvider extends AuthProvider {
  constructor(config = {}, LoginView = null, trackAuthEvent = () => {}) {
    super(config, LoginView);
    this.trackAuthEvent = trackAuthEvent;
    this.recoveryPromise = null;
    this.tokenPromise = null;
    this.reauthPending = false;
  }

  authEvent(name, context = {}) {
    this.trackAuthEvent(name, {
      ...context,
      pathname: location.pathname,
      online: navigator.onLine,
    });
  }

  async getToken(options) {
    if (!this.client) return;
    if (!navigator.onLine) return this.token;
    if (this.reauthPending) return null;
    if (this.tokenPromise) return this.tokenPromise;

    this.tokenPromise = this.client
      .getAccessToken(options)
      .then(token => {
        this.token = `Bearer ${ token }`;
        this.reauthPending = false;
        return this.token;
      })
      .catch(error => {
        if (!navigator.onLine) return;

        this.authEvent('AUTH_GET_TOKEN_FAILED', {
          reason: error instanceof LoginRequiredError ? 'login_required' : 'get_access_token_failed',
          error: error?.message,
        });
        this.token = null;

        if (error instanceof LoginRequiredError) {
          this.beginReauth('auth_login_required');
        }

        return null;
      })
      .finally(() => {
        this.tokenPromise = null;
      });

    return this.tokenPromise;
  }

  async recoverToken() {
    if (!this.client) {
      throw new LoginRequiredError();
    }

    const token = await this.client.getAccessToken({ forceRefresh: true });

    this.token = `Bearer ${ token }`;
    this.reauthPending = false;

    return this.token;
  }

  async recoverAuth() {
    if (!this.recoveryPromise) {
      this.recoveryPromise = Promise.resolve()
        // Clear the app bearer so concurrent callers don't reuse a stale header while AuthKit refreshes.
        .then(() => this.clearToken())
        .then(() => this.recoverToken())
        .finally(() => {
          this.recoveryPromise = null;
        });
    }

    return this.recoveryPromise;
  }

  login(path = AuthProvider.PATH_ROOT) {
    this.client.signIn({ state: path });
  }

  beginReauth(reason, path = location.pathname) {
    if (this.reauthPending) return;

    this.loginPrompt(path, reason);
  }

  loginPrompt(path, reason = 'auth_required') {
    this.reauthPending = true;
    this.authEvent('AUTH_LOGIN_PROMPT', { reason });

    if (!this.client) {
      this.replaceState(AuthProvider.PATH_LOGIN);
      return;
    }

    try {
      super.loginPrompt(path);
    } catch (error) {
      this.authEvent('AUTH_LOGIN_PROMPT_FAILED', {
        reason: 'render_failed',
        error: error?.message,
      });
      this.login(path);
    }
  }

  async handleUnauthorized(retry) {
    this.authEvent('AUTH_401', { reason: 'api_unauthorized' });

    if (!navigator.onLine) return;
    if (this.reauthPending) return;

    try {
      await this.recoverAuth();
    } catch (error) {
      if (error instanceof LoginRequiredError) {
        this.beginReauth('auth_recovery_failed');
      }
      return;
    }

    const response = await retry();

    if (response.status === 401) {
      this.beginReauth('auth_retry_unauthorized');
    }

    return response;
  }

  async _initClient(clientId, success) {
    const authProvider = this;
    const clientConfig = {
      redirectUri: location.origin + AuthProvider.PATH_AUTHD,
      onRedirectCallback({ user, state }) {
        const path = state;
        if (path === AuthProvider.PATH_LOGOUT) {
          this.signOut({ returnTo: location.origin });
          return;
        }

        if (!user) {
          authProvider.loginPrompt(path);
          return;
        }

        authProvider.reauthPending = false;
        authProvider.handleAuthedPath(path);

        success();
      },
      onRefreshFailure() {
        authProvider.authEvent('AUTH_REFRESH_FAILED', { reason: 'refresh_failed' });
        if (!navigator.onLine) return;
        authProvider.beginReauth('auth_refresh_failed');
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

    const { clientId } = this.config;

    this.client = await this._initClient(clientId, success);

    // pathName will be PATH_AUTHD here if we are expecting client.onRedirectCallback
    if (pathName === AuthProvider.PATH_AUTHD) return;

    if (pathName === AuthProvider.PATH_LOGOUT) {
      this.token = null;

      let user = null;

      try {
        user = await this.client.getUser();
      } catch (e) {
        this.authEvent('AUTH_LOGOUT', {
          reason: 'logout_get_user_failed',
          error: e?.message,
        });
      }

      if (user) {
        try {
          await this.client.signOut({ returnTo: location.origin });
          return;
        } catch (e) {
          this.authEvent('AUTH_LOGOUT', {
            reason: 'logout_sign_out_failed',
            error: e?.message,
          });
        }
      }

      if (hasWorkosSessionCookie(clientId)) {
        this.client.signIn({ state: AuthProvider.PATH_LOGOUT });
        return;
      }

      this.replaceRoot();
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

    this.reauthPending = false;

    // If we're already authenticated and at the right path
    success();
  }

  async logout(reason = 'user') {
    this.token = null;
    this.reauthPending = false;

    this.authEvent('AUTH_LOGOUT', { reason });

    try {
      await this.client.signOut({ returnTo: location.origin });
    } catch {
      this.replaceRoot();
    }
  }
}
