import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from './stores/auth';
import LoginView from './views/LoginView.vue';
import AppShell from './views/AppShell.vue';
import MonitorsView from './views/MonitorsView.vue';
import UsersView from './views/UsersView.vue';
import LogView from './views/LogView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', component: MonitorsView },
        { path: 'users', component: UsersView, meta: { admin: true } },
        { path: 'log', component: LogView },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuth();
  if (to.meta.public) return true;
  if (!auth.token) return '/login';
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
      return '/login';
    }
  }
  if (to.meta.admin && !auth.isAdmin) return '/';
  return true;
});

export default router;
