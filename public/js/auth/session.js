// Session management — token lifecycle, auto-logout
const Session = {
  TOKEN_KEY: 'mc_token',
  PHONE_KEY: 'mc_phone',
  SESSION_START: 'mc_session_start',

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.SESSION_START, new Date().toISOString());
  },

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  getPhone() {
    return localStorage.getItem(this.PHONE_KEY);
  },

  setPhone(phone) {
    localStorage.setItem(this.PHONE_KEY, phone);
  },

  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.PHONE_KEY);
    localStorage.removeItem(this.SESSION_START);
  },

  isTokenExpired() {
    const token = this.getToken();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  },

  isSessionExpired() {
    const start = localStorage.getItem(this.SESSION_START);
    if (!start) return true;
    const daysSince = (Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 30;
  },

  isValid() {
    return !this.isTokenExpired() && !this.isSessionExpired();
  },
};
