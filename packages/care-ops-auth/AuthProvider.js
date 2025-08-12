export class AuthProvider {
  static PATH_ROOT = '/';
  static PATH_RWELL = '/rw';
  static PATH_AUTHD = '/authenticated';
  static PATH_LOGIN = '/login';
  static PATH_LOGOUT = '/logout';

  constructor(config = {}, LoginView = null) {
    this.config = config;
    this.LoginView = LoginView;
    this.token = config.token || null;
    this.client = null;
  }

  async auth(success) {
    if (location.pathname === AuthProvider.PATH_LOGOUT) {
      this.logout();
      return;
    }

    this.handleAuthedPath(location.pathname);

    success();
  }

  frameBust() {
    if (top !== self) {
      top.location = AuthProvider.PATH_LOGIN;
    }
  }

  handleAuthedPath(path) {
    if (path === AuthProvider.PATH_LOGIN) {
      this.replaceState(AuthProvider.PATH_ROOT);
      return;
    }

    if (path === AuthProvider.PATH_RWELL) {
      this.replaceState(AuthProvider.PATH_ROOT);
      localStorage.setItem(AuthProvider.PATH_RWELL, 1);
      return;
    }
    this.replaceState(path || AuthProvider.PATH_ROOT);
  }

  login() {
    throw new Error('Login method must be implemented by subclass');
  }

  loginPrompt(...args) {
    if (!this.LoginView) {
      this.login(...args);
      return;
    }

    const loginPromptView = new this.LoginView();

    loginPromptView.on('click:login', () => {
      this.login(...args);
    });

    loginPromptView.render();

    this.replaceState(AuthProvider.PATH_LOGIN);
  }

  logout() {
    window.location = AuthProvider.PATH_LOGOUT;
  }

  setToken(tokenString) {
    this.token = tokenString;
  }

  async getToken() {
    return this.token;
  }

  replaceState(state) {
    window.history.replaceState({}, document.title, state);
  }
}
