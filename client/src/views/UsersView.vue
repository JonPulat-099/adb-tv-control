<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '../api';
import { useAuth } from '../stores/auth';
import { useToast } from '../stores/toast';
import Icon from '../components/Icon.vue';

const auth = useAuth();
const toast = useToast();

const users = ref([]);
const error = ref('');
const formOpen = ref(false);
const formError = ref('');
const busy = ref(false);
const confirmId = ref(null);
const form = reactive({ login: '', name: '', password: '', role: 'moderator' });

const PERMISSIONS = [
  ['Просмотр мониторов и их статуса', true, true],
  ['Питание, громкость, источник, пульт', true, true],
  ['Открыть ссылку, запустить приложение', true, true],
  ['Включить все / все в ожидание', true, true],
  ['Добавление и удаление мониторов', true, false],
  ['Управление пользователями и ролями', true, false],
  ['Журнал действий', true, true],
];

async function load() {
  try {
    users.value = await api('/users');
    error.value = '';
  } catch (e) {
    error.value = e.message;
  }
}
onMounted(load);

async function changeRole(u, role) {
  try {
    const updated = await api(`/users/${u.id}`, { method: 'PATCH', body: { role } });
    Object.assign(u, updated);
    toast.show(`${u.login}: роль изменена`);
    if (u.id === auth.user.id) await auth.fetchMe();
  } catch (e) {
    toast.show(e.message);
    await load();
  }
}

async function addUser() {
  formError.value = '';
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(form.login)) {
    formError.value = 'Логин: 3–32 символа, латиница, цифры, точка, дефис или подчёркивание';
    return;
  }
  if (!form.name.trim()) { formError.value = 'Укажите имя'; return; }
  if (form.password.length < 8) { formError.value = 'Пароль должен быть не короче 8 символов'; return; }
  busy.value = true;
  try {
    const u = await api('/users', { method: 'POST', body: { ...form, name: form.name.trim() } });
    users.value.push(u);
    toast.show(`Пользователь ${u.login} добавлен`);
    Object.assign(form, { login: '', name: '', password: '', role: 'moderator' });
    formOpen.value = false;
  } catch (e) {
    formError.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function removeUser(u) {
  try {
    await api(`/users/${u.id}`, { method: 'DELETE' });
    users.value = users.value.filter((x) => x.id !== u.id);
    toast.show(`Пользователь ${u.login} удалён`);
  } catch (e) {
    toast.show(e.message);
  } finally {
    confirmId.value = null;
  }
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div class="page-head-text">
        <h1>Пользователи и роли</h1>
        <span class="muted">Роли меняет только администратор</span>
      </div>
      <button class="btn btn-primary" type="button" @click="formOpen = !formOpen">
        <Icon name="plus" :size="16" />Добавить пользователя
      </button>
    </header>

    <div class="page-body stack">
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>

      <form v-if="formOpen" class="new-user" @submit.prevent="addUser">
        <h2>Новый пользователь</h2>
        <div class="form-grid">
          <div class="field">
            <label for="u-login">Логин</label>
            <input id="u-login" v-model="form.login" class="input mono" autocomplete="off">
          </div>
          <div class="field">
            <label for="u-name">Имя</label>
            <input id="u-name" v-model="form.name" class="input">
          </div>
          <div class="field">
            <label for="u-pass">Пароль</label>
            <input id="u-pass" v-model="form.password" class="input" type="password" autocomplete="new-password">
          </div>
          <div class="field">
            <label for="u-role">Роль</label>
            <select id="u-role" v-model="form.role" class="input">
              <option value="moderator">Модератор</option>
              <option value="admin">Администратор</option>
            </select>
          </div>
        </div>
        <p v-if="formError" class="error-text" role="alert">{{ formError }}</p>
        <div class="form-foot">
          <button class="btn btn-plain" type="button" @click="formOpen = false">Отмена</button>
          <button class="btn btn-primary" type="submit" :disabled="busy">Добавить</button>
        </div>
      </form>

      <div class="table">
        <div class="table-row table-head users-row">
          <span>Имя</span><span>Логин</span><span>Роль</span><span class="sr-only">Действия</span>
        </div>
        <div v-for="u in users" :key="u.id" class="table-row users-row">
          <span class="strong">{{ u.name }}<span v-if="u.id === auth.user.id" class="muted"> (вы)</span></span>
          <span class="mono muted">{{ u.login }}</span>
          <span>
            <label :for="`role-${u.id}`" class="sr-only">Роль пользователя {{ u.login }}</label>
            <select :id="`role-${u.id}`" class="input role" :value="u.role" @change="changeRole(u, $event.target.value)">
              <option value="admin">Администратор</option>
              <option value="moderator">Модератор</option>
            </select>
          </span>
          <span class="row-actions">
            <template v-if="u.id !== auth.user.id">
              <button v-if="confirmId !== u.id" class="btn btn-danger" type="button" @click="confirmId = u.id">Удалить</button>
              <template v-else>
                <button class="btn" type="button" @click="confirmId = null">Отмена</button>
                <button class="btn btn-danger-fill" type="button" @click="removeUser(u)">Точно удалить</button>
              </template>
            </template>
          </span>
        </div>
      </div>

      <section class="stack-sm">
        <h2>Права ролей</h2>
        <div class="table">
          <div class="table-row table-head perm-row"><span>Действие</span><span>Администратор</span><span>Модератор</span></div>
          <div v-for="p in PERMISSIONS" :key="p[0]" class="table-row perm-row">
            <span>{{ p[0] }}</span>
            <span :class="p[1] ? 'yes' : 'muted'">{{ p[1] ? 'Да' : 'Нет' }}</span>
            <span :class="p[2] ? 'yes' : 'muted'">{{ p[2] ? 'Да' : 'Нет' }}</span>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.stack { display: flex; flex-direction: column; gap: 24px; }
.stack-sm { display: flex; flex-direction: column; gap: 12px; }
.new-user {
  display: flex; flex-direction: column; gap: 16px; padding: 24px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
}
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.form-foot { display: flex; justify-content: flex-end; gap: 10px; }
.error-text { margin: 0; }
.users-row { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 210px 230px; }
.perm-row { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr); }
.strong { font-weight: 500; }
.role { height: 40px; }
.row-actions { display: flex; gap: 8px; justify-content: flex-end; }
.yes { color: var(--st-online); }
@media (max-width: 900px) {
  .users-row { grid-template-columns: 1fr 1fr; }
  .users-row.table-head { display: none; }
  .row-actions { justify-content: flex-start; }
}
</style>
