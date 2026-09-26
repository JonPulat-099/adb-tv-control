import { defineStore } from 'pinia';

let timer;

export const useToast = defineStore('toast', {
  state: () => ({ message: '' }),
  actions: {
    show(message) {
      this.message = message;
      clearTimeout(timer);
      timer = setTimeout(() => { this.message = ''; }, 3000);
    },
  },
});
