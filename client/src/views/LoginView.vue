<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import Icon from '../components/Icon.vue';

const auth = useAuth();
const router = useRouter();
const login = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await auth.login(login.value.trim(), password.value);
    router.push('/');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="login">
    <form class="card" @submit.prevent="submit">
      <div class="brand">
        <span class="mark"><Icon name="tv" :size="22" /></span>
        ТВ Пульт
      </div>
      <div class="intro">
        <h1>Вход в панель</h1>
        <p class="muted">Управление телевизорами Xiaomi по сети</p>
      </div>
      <div class="field">
        <label for="login">Логин</label>
        <input id="login" v-model="login" class="input" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="password">Пароль</label>
        <input id="password" v-model="password" class="input" type="password" autocomplete="current-password" required>
      </div>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="busy">
        {{ busy ? 'Вход…' : 'Войти' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
.card {
  width: 100%; max-width: 420px; padding: 40px; display: flex; flex-direction: column; gap: 20px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
}
.brand { display: flex; align-items: center; gap: 12px; font-family: var(--font-display); font-size: 17px; font-weight: 600; }
.mark {
  width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: var(--on-accent);
}
.intro { display: flex; flex-direction: column; gap: 6px; }
.intro h1 { font-size: 26px; }
.intro p { margin: 0; }
.error-text { margin: 0; }
.btn { height: 48px; font-size: 15px; }
@media (max-width: 480px) { .card { padding: 28px 20px; } }
</style>
