<script setup>
import { computed } from 'vue';
import { statusOf, formatTime } from '../status';
import Icon from './Icon.vue';

const props = defineProps({
  monitor: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});
const emit = defineEmits(['select', 'power', 'refresh']);

const st = computed(() => statusOf(props.monitor.status));
const canPower = computed(() => ['online', 'standby'].includes(props.monitor.status));
const powerLabel = computed(() => (props.monitor.status === 'online' ? 'Перевести в ожидание' : 'Включить'));
</script>

<template>
  <article class="card" :class="{ selected }">
    <div class="screen" :class="`screen-${monitor.status}`">
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
    <div class="actions">
      <button class="btn remote" :class="{ 'btn-soft': selected }" type="button" @click="emit('select', monitor.id)">
        {{ selected ? 'Пульт открыт' : 'Пульт' }}
      </button>
      <button v-if="canPower" class="btn btn-icon" type="button" :style="{ color: st.color }"
        :aria-label="`${powerLabel}: ${monitor.name}`" :title="powerLabel" @click="emit('power', monitor)">
        <Icon name="power" />
      </button>
      <button v-else class="btn" type="button" @click="emit('refresh', monitor.id)">Переподключить</button>
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
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.name { margin: 0; font-size: 17px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 13px; color: var(--muted); }
.actions { display: flex; gap: 8px; }
.remote { flex: 1; }
</style>
