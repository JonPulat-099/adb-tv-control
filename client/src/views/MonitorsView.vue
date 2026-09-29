<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuth } from '../stores/auth';
import { useMonitors } from '../stores/monitors';
import { useToast } from '../stores/toast';
import MonitorCard from '../components/MonitorCard.vue';
import RemotePanel from '../components/RemotePanel.vue';
import MonitorModal from '../components/MonitorModal.vue';
import Icon from '../components/Icon.vue';

const auth = useAuth();
const monitors = useMonitors();
const toast = useToast();

const filter = ref('all');
const selectedId = ref(null);
const addOpen = ref(false);
const editId = ref(null);
const bulkBusy = ref(false);

onMounted(() => monitors.startPolling());
onUnmounted(() => monitors.stopPolling());

const offlineCount = computed(() => monitors.list.filter((m) => !['online', 'standby'].includes(m.status)).length);

const filters = computed(() => [
  { key: 'all', label: 'Все', count: monitors.list.length },
  { key: 'online', label: 'В сети', count: monitors.count('online') },
  { key: 'standby', label: 'Ожидание', count: monitors.count('standby') },
  { key: 'offline', label: 'Нет связи', count: offlineCount.value },
]);

const shown = computed(() => monitors.list.filter((m) => {
  if (filter.value === 'all') return true;
  if (filter.value === 'offline') return !['online', 'standby'].includes(m.status);
  return m.status === filter.value;
}));

const selected = computed(() => monitors.list.find((m) => m.id === selectedId.value) || null);
const editing = computed(() => monitors.list.find((m) => m.id === editId.value) || null);

async function power(m) {
  const wake = m.status !== 'online';
  try {
    await monitors.command(m.id, 'key', wake ? 'wake' : 'sleep');
    toast.show(`${m.name}: ${wake ? 'включён' : 'в режиме ожидания'}`);
  } catch (e) {
    toast.show(e.message);
  }
}

async function refresh(id) {
  try {
    await monitors.refresh(id);
  } catch (e) {
    toast.show(e.message);
  }
}

async function bulk(action) {
  bulkBusy.value = true;
  try {
    const r = await monitors.bulk(action);
    toast.show(`${action === 'wake' ? 'Включено' : 'Переведено в ожидание'}: ${r.done} из ${r.total}`);
  } catch (e) {
    toast.show(e.message);
  } finally {
    bulkBusy.value = false;
  }
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div class="page-head-text">
        <h1>Мониторы</h1>
        <div class="stats">
          <span>Всего: {{ monitors.list.length }}</span>
          <span class="s-online">В сети: {{ monitors.count('online') }}</span>
          <span class="s-standby">Ожидание: {{ monitors.count('standby') }}</span>
          <span>Нет связи: {{ offlineCount }}</span>
        </div>
      </div>
      <div class="head-actions">
        <button class="btn" type="button" :disabled="bulkBusy" @click="bulk('wake')">Включить все</button>
        <button class="btn" type="button" :disabled="bulkBusy" @click="bulk('sleep')">Все в ожидание</button>
        <button v-if="auth.isAdmin" class="btn btn-primary" type="button" @click="addOpen = true">
          <Icon name="plus" :size="16" />Добавить монитор
        </button>
        <button v-else class="btn btn-locked" type="button" disabled>
          <Icon name="lock" :size="16" />Добавление — только админ
        </button>
      </div>
    </header>

    <div class="filters" role="group" aria-label="Фильтр по статусу">
      <button v-for="f in filters" :key="f.key" type="button" class="chip"
        :class="{ active: filter === f.key }" :aria-pressed="filter === f.key" @click="filter = f.key">
        {{ f.label }} ({{ f.count }})
      </button>
    </div>

    <div class="page-body">
      <p v-if="monitors.error" class="error-text" role="alert">{{ monitors.error }}</p>
      <div v-if="monitors.loaded && !monitors.list.length" class="empty">
        <template v-if="auth.isAdmin">
          Мониторов пока нет. <button class="btn btn-primary first" type="button" @click="addOpen = true">Добавить первый монитор</button>
        </template>
        <template v-else>Мониторов пока нет. Их добавляет администратор.</template>
      </div>
      <div v-else-if="monitors.loaded && !shown.length" class="empty">В этой категории мониторов нет</div>
      <div class="grid">
        <MonitorCard v-for="m in shown" :key="m.id" :monitor="m" :selected="m.id === selectedId"
          @select="selectedId = $event" @power="power" @refresh="refresh" />
      </div>
    </div>
  </main>

  <RemotePanel v-if="selected" :monitor="selected" @close="selectedId = null" @edit="editId = $event" />
  <MonitorModal v-if="addOpen" @close="addOpen = false" />
  <MonitorModal v-if="editing" :key="editing.id" :monitor="editing" @close="editId = null" />
</template>

<style scoped>
.stats { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 14px; color: var(--muted); }
.s-online { color: var(--st-online); }
.s-standby { color: var(--st-standby); }
.head-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 32px 0; }
.chip {
  min-height: 36px; padding: 0 14px; border-radius: 18px; font-size: 13px;
  border: 1px solid var(--line-strong); background: transparent; color: var(--text-2);
}
.chip.active { background: var(--text); border-color: var(--text); color: var(--bg); }
.page-body { padding-top: 16px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.empty { margin-bottom: 16px; }
.first { margin-left: 12px; }
.error-text { margin: 0 0 16px; }
@media (max-width: 720px) { .filters { padding: 12px 16px 0; } }
</style>
