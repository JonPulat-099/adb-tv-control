<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import { useMonitors } from '../stores/monitors';
import Icon from '../components/Icon.vue';

const auth = useAuth();
const monitors = useMonitors();
const router = useRouter();

const roleLabel = computed(() => (auth.isAdmin ? 'Администратор' : 'Модератор'));
const initial = computed(() => (auth.user?.name || auth.user?.login || '?').slice(0, 1).toUpperCase());

function logout() {
  monitors.stopPolling();
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="shell">
    <aside class="side">
      <div class="brand">
        <span class="mark"><Icon name="tv" :size="20" /></span>
        ТВ Пульт
      </div>
      <nav class="nav" aria-label="Разделы">
        <RouterLink to="/" class="nav-link" exact-active-class="active">
          <Icon name="tv" />
          <span class="nav-text">Мониторы</span>
          <span class="nav-count mono">{{ monitors.list.length }}</span>
        </RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/users" class="nav-link" active-class="active">
          <Icon name="users" />
          <span class="nav-text">Пользователи и роли</span>
        </RouterLink>
        <RouterLink to="/log" class="nav-link" active-class="active">
          <Icon name="log" />
          <span class="nav-text">Журнал действий</span>
        </RouterLink>
      </nav>
      <div class="me">
        <div class="me-row">
          <span class="avatar">{{ initial }}</span>
          <div class="me-text">
            <strong>{{ auth.user?.login }}</strong>
            <span class="role">{{ roleLabel }}</span>
          </div>
        </div>
        <button class="btn" type="button" @click="logout"><Icon name="logout" :size="16" />Выйти</button>
      </div>
    </aside>
    <RouterView />
  </div>
</template>

<style scoped>
.shell { display: flex; min-height: 100vh; }
.side {
  width: 248px; flex-shrink: 0; height: 100vh; position: sticky; top: 0;
  display: flex; flex-direction: column; gap: 28px; padding: 24px 16px;
  background: var(--side); border-right: 1px solid var(--line-soft);
}
.brand { display: flex; align-items: center; gap: 12px; padding: 0 8px; font-family: var(--font-display); font-size: 16px; font-weight: 600; }
.mark {
  width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: var(--on-accent);
}
.nav { display: flex; flex-direction: column; gap: 4px; }
.nav-link {
  display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 14px;
  border-radius: 10px; color: var(--muted); text-decoration: none; font-size: 15px;
}
.nav-link:hover { color: var(--text); }
.nav-link.active { background: var(--surface-2); color: var(--text); }
.nav-text { flex: 1; }
.nav-count { font-size: 13px; color: var(--muted); }
.me {
  margin-top: auto; display: flex; flex-direction: column; gap: 12px; padding: 16px;
  background: var(--panel); border: 1px solid var(--line-soft); border-radius: 12px;
}
.me-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.avatar {
  width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; background: var(--line);
  display: flex; align-items: center; justify-content: center; font-weight: 600;
}
.me-text { display: flex; flex-direction: column; min-width: 0; font-size: 14px; }
.me-text strong { overflow: hidden; text-overflow: ellipsis; }
.role { font-size: 12px; color: var(--accent); }

@media (max-width: 900px) {
  .shell { flex-direction: column; }
  .side {
    width: 100%; height: auto; position: static; flex-direction: row; align-items: center;
    flex-wrap: wrap; gap: 12px; padding: 12px 16px; border-right: none; border-bottom: 1px solid var(--line-soft);
  }
  .nav { flex-direction: row; flex-wrap: wrap; }
  .nav-count { display: none; }
  .me { margin: 0 0 0 auto; flex-direction: row; align-items: center; padding: 8px 12px; }
}
@media (max-width: 560px) {
  .nav-text, .me-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
}
</style>
