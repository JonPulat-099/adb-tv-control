<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { statusOf, formatTime } from '../status';
import { apiBlob } from '../api';
import Icon from './Icon.vue';

const props = defineProps({
  monitor: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});
const emit = defineEmits(['select', 'power', 'refresh']);

const st = computed(() => statusOf(props.monitor.status));
const canPower = computed(() => ['online', 'standby'].includes(props.monitor.status));
const powerLabel = computed(() => (props.monitor.status === 'online' ? 'Перевести в ожидание' : 'Включить'));
// On-demand screenshot of what the TV is showing
const shot = ref(null); // { url, at }
const shotLoading = ref(false);
const shotError = ref('');

function clearShot() {
  if (shot.value) URL.revokeObjectURL(shot.value.url);
  shot.value = null;
  shotError.value = '';
}

async function loadShot() {
  if (props.monitor.status !== 'online' || shotLoading.value) return;
  shotLoading.value = true;
  shotError.value = '';
  try {
    const blob = await apiBlob(`/monitors/${props.monitor.id}/screen`);
    if (props.monitor.status !== 'online') return;
    clearShot();
    shot.value = { url: URL.createObjectURL(blob), at: new Date().toISOString() };
  } catch (e) {
    shotError.value = e.message;
  } finally {
    shotLoading.value = false;
  }
}

watch(() => props.monitor.status, (s) => { if (s !== 'online') clearShot(); });
onBeforeUnmount(clearShot);

const startupHost = computed(() => {
  try {
    return props.monitor.startup_url ? new URL(props.monitor.startup_url).host : '';
  } catch {
    return '';
  }
});
</script>

<template>
  <article class="card" :class="{ selected }">
    <button v-if="monitor.status === 'online'" class="screen screen-online screen-btn" type="button"
      :class="{ loading: shotLoading }" :aria-label="`Показать экран: ${monitor.name}`" @click="loadShot">
      <template v-if="shot">
        <img class="shot" :src="shot.url" alt="" />
        <span class="shot-time">{{ shotLoading ? 'Обновление…' : `Снимок в ${formatTime(shot.at)}` }}</span>
      </template>
      <template v-else>
        <span class="screen-title">{{ shotLoading ? 'Получение снимка…' : st.screen }}</span>
        <span v-if="shotError" class="screen-sub screen-err">{{ shotError }}</span>
        <span v-else class="screen-sub">Нажмите, чтобы показать экран</span>
      </template>
    </button>
    <div v-else class="screen" :class="`screen-${monitor.status}`">
      <span class="screen-title">{{ st.screen }}</span>
      <span v-if="monitor.checkedAt" class="screen-sub">Проверено в {{ formatTime(monitor.checkedAt) }}</span>
    </div>
    <div class="row">
      <h3 class="name">{{ monitor.name }}</h3>
      <span class="status" :style="{ color: st.color }">{{ st.label }}</span>
    </div>
    <div class="row meta">
      <span>{{ monitor.location || 'Без расположения' }}</span>
      <span class="mono">{{ monitor.ip }}:{{ monitor.port }}</span>
    </div>
    <div v-if="startupHost" class="meta startup" :title="monitor.startup_url">При включении: {{ startupHost }}</div>
    <div class="actions">
      <button class="btn remote" :class="{ 'btn-soft': selected }" type="button" @click="emit('select', monitor.id)">
        {{ selected ? 'Пульт открыт' : 'Пульт' }}
      </button>
      <button v-if="canPower" class="btn btn-icon" type="button" :style="{ color: st.color }"
        :aria-label="`${powerLabel}: ${monitor.name}`" :title="powerLabel" @click="emit('power', monitor)">
        <Icon name="power" />
      </button>
      <button v-else class="btn btn-icon" type="button" :aria-label="`Переподключить: ${monitor.name}`"
        title="Переподключить" @click="emit('refresh', monitor.id)">
        <Icon name="refresh" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex; flex-direction: column; gap: 14px; padding: 16px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
}
.card.selected { border-color: var(--accent); }
.screen {
  height: 112px; border-radius: 10px; border: 1px solid var(--line-soft);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  background: #101213; color: #8a9096; text-align: center; padding: 0 12px;
}
.screen-online { background: #0f2230; color: #cfe9ff; }
.screen-standby { background: #17151f; color: var(--st-standby); }
.screen-unauthorized { background: #221b0e; color: var(--st-auth); }
.screen-title { font-size: 15px; font-weight: 500; }
.screen-sub { font-size: 12px; color: var(--muted); }
.screen-err { color: var(--danger); }
.screen-btn { position: relative; overflow: hidden; width: 100%; cursor: pointer; font: inherit; }
.screen-btn:hover { border-color: var(--line); }
.screen-btn.loading { cursor: progress; }
.shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #000; }
.screen-btn.loading .shot { opacity: .55; }
.shot-time {
  position: absolute; right: 6px; bottom: 6px; padding: 2px 6px; border-radius: 6px;
  background: rgba(0, 0, 0, .65); color: #fff; font-size: 11px;
}
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.name { margin: 0; font-size: 17px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 13px; color: var(--muted); }
.startup { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Pinned to the bottom so buttons line up across cards of different heights */
.actions { display: flex; gap: 8px; margin-top: auto; }
.remote { flex: 1; min-width: 0; }
</style>
