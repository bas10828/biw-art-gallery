const Auth = {
  KEY: 'biw_gallery_user',

  login(username) {
    if (!username || !username.trim()) return false;
    const user = { username: username.trim(), loginTime: Date.now() };
    localStorage.setItem(this.KEY, JSON.stringify(user));
    return true;
  },

  logout() {
    localStorage.removeItem(this.KEY);
  },

  getUser() {
    const data = localStorage.getItem(this.KEY);
    return data ? JSON.parse(data) : null;
  },

  isLoggedIn() {
    return !!this.getUser();
  }
};
