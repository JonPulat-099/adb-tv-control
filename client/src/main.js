import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuth } from './stores/auth';
import './style.css';

const app = createApp(App).use(createPinia()).use(router);

window.addEventListener('auth:expired', () => {
  useAuth().logout();
  router.push('/login');
});

app.mount('#app');
