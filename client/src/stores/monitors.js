import { defineStore } from 'pinia';
import { api } from '../api';

let timer = null;

export const useMonitors = defineStore('monitors', {
  state: () => ({ list: [], loaded: false, error: '' }),
  getters: {
    count: (s) => (status) => s.list.filter((m) => m.status === status).length,
  },
  actions: {
    async load() {
      try {
        this.list = await api('/monitors');
        this.error = '';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loaded = true;
      }
    },
    startPolling() {
      this.stopPolling();
      this.load();
      timer = setInterval(() => this.load(), 5000);
    },
    stopPolling() {
      clearInterval(timer);
      timer = null;
    },
    patchLocal(id, patch) {
      const m = this.list.find((x) => x.id === id);
      if (m && patch?.status) Object.assign(m, { status: patch.status, checkedAt: patch.checkedAt });
    },
    async command(id, action, value) {
      const r = await api(`/monitors/${id}/command`, { method: 'POST', body: { action, value } });
      this.patchLocal(id, r);
      return r;
    },
    async refresh(id) {
      this.patchLocal(id, await api(`/monitors/${id}/refresh`, { method: 'POST' }));
    },
    async bulk(action) {
      const r = await api('/monitors/bulk', { method: 'POST', body: { action } });
      await this.load();
      return r;
    },
    test(ip, port) {
      return api('/monitors/test', { method: 'POST', body: { ip, port } });
    },
    async add(data) {
      const m = await api('/monitors', { method: 'POST', body: data });
      this.list.push(m);
      return m;
    },
    async remove(id) {
      await api(`/monitors/${id}`, { method: 'DELETE' });
      this.list = this.list.filter((m) => m.id !== id);
    },
  },
});
