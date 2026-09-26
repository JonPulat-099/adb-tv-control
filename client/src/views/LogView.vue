<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { formatTime } from '../status';
import Icon from '../components/Icon.vue';

const entries = ref([]);
const error = ref('');
const loaded = ref(false);

async function load() {
  try {
    entries.value = await api('/logs?limit=300');
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loaded.value = true;
  }
}
onMounted(load);
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div class="page-head-text">
        <h1>Журнал действий</h1>
        <span class="muted">Кто, когда и что сделал с мониторами</span>
      </div>
      <button class="btn" type="button" @click="load"><Icon name="refresh" :size="16" />Обновить</button>
    </header>
    <div class="page-body">
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div v-if="loaded && !entries.length" class="empty">Пока пусто. Действия с мониторами появятся здесь.</div>
      <div v-else-if="entries.length" class="table">
        <div class="table-row table-head log-row"><span>Время</span><span>Пользователь</span><span>Действие</span><span>Объект</span></div>
        <div v-for="e in entries" :key="e.id" class="table-row log-row">
          <span class="mono muted">{{ formatTime(e.at, true) }}</span>
          <span>{{ e.user_login }}</span>
          <span :class="{ failed: !e.ok }">{{ e.action }}<template v-if="!e.ok"> — ошибка</template></span>
          <span class="muted">{{ e.target }}</span>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.log-row { grid-template-columns: 170px minmax(0, 0.8fr) minmax(0, 1.6fr) minmax(0, 1fr); font-size: 14px; }
.failed { color: var(--danger); }
.error-text { margin: 0 0 16px; }
@media (max-width: 720px) {
  .log-row { grid-template-columns: 1fr 1fr; }
  .log-row.table-head { display: none; }
}
</style>
