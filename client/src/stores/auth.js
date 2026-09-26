import { defineStore } from 'pinia';
import { api } from '../api';

export const useAuth = defineStore('auth', {
  state: () => ({ token: localStorage.getItem('token') || '', user: null }),
  getters: {
    isAdmin: (s) => s.user?.role === 'admin',
  },
  actions: {
    async login(login, password) {
      const r = await api('/auth/login', { method: 'POST', body: { login, password } });
      this.token = r.token;
      this.user = r.user;
      localStorage.setItem('token', r.token);
    },
    async fetchMe() {
      this.user = await api('/auth/me');
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
    },
  },
});
