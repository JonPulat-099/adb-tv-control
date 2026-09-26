<script setup>
import { ref, computed, watch } from 'vue';
import { useAuth } from '../stores/auth';
import { useMonitors } from '../stores/monitors';
import { useToast } from '../stores/toast';
import { statusOf } from '../status';
import Icon from './Icon.vue';

const props = defineProps({ monitor: { type: Object, required: true } });
const emit = defineEmits(['close']);

const auth = useAuth();
const monitors = useMonitors();
const toast = useToast();

const url = ref('');
const pkg = ref('');
const busy = ref(false);
const confirmDelete = ref(false);
const startupDraft = ref(props.monitor.startup_url || '');

watch(() => props.monitor.id, () => {
  url.value = '';
  pkg.value = '';
  startupDraft.value = props.monitor.startup_url || '';
  confirmDelete.value = false;
});

const st = computed(() => statusOf(props.monitor.status));
const canControl = computed(() => props.monitor.status === 'online');
const canPower = computed(() => ['online', 'standby'].includes(props.monitor.status));
const powerLabel = computed(() => (props.monitor.status === 'online' ? 'Перевести в ожидание' : 'Включить'));

const INPUTS = [
  { key: 'hdmi1', label: 'HDMI 1' },
  { key: 'hdmi2', label: 'HDMI 2' },
  { key: 'hdmi3', label: 'HDMI 3' },
  { key: 'tv', label: 'ТВ' },
];

// Remote buttons: fire quickly, report only failures
async function key(value) {
  try {
    await monitors.command(props.monitor.id, 'key', value);
  } catch (e) {
    toast.show(e.message);
  }
}

async function run(action, value, okMessage) {
  busy.value = true;
  try {
    await monitors.command(props.monitor.id, action, value);
    if (okMessage) toast.show(okMessage);
    return true;
  } catch (e) {
    toast.show(e.message);
    return false;
  } finally {
    busy.value = false;
  }
}

function power() {
  const wake = props.monitor.status !== 'online';
  run('key', wake ? 'wake' : 'sleep', `${props.monitor.name}: ${wake ? 'включён' : 'в режиме ожидания'}`);
}

async function openUrl() {
  if (!/^https?:\/\/\S+$/.test(url.value.trim())) {
    toast.show('Введите адрес, начиная с http:// или https://');
    return;
  }
  if (await run('open_url', url.value.trim(), 'Ссылка открыта')) url.value = '';
}

async function saveStartup(value) {
  const v = value.trim();
  if (v && !/^https?:\/\/\S+$/.test(v)) {
    toast.show('Введите адрес, начиная с http:// или https://');
    return;
  }
  busy.value = true;
  try {
    await monitors.setStartup(props.monitor.id, v);
    startupDraft.value = v;
    toast.show(v ? 'Стартовая ссылка сохранена' : 'Стартовая ссылка убрана');
  } catch (e) {
    toast.show(e.message);
  } finally {
    busy.value = false;
  }
}

function launch(name) {
  const value = (name || '').trim();
  if (!value) return;
  run('launch_app', value, `Запущено: ${value}`);
}

async function refresh() {
  busy.value = true;
  try {
    await monitors.refresh(props.monitor.id);
    toast.show(`${props.monitor.name}: ${statusOf(props.monitor.status).label.toLowerCase()}`);
  } catch (e) {
    toast.show(e.message);
  } finally {
    busy.value = false;
  }
}

async function remove() {
  busy.value = true;
  try {
    const name = props.monitor.name;
    await monitors.remove(props.monitor.id);
    toast.show(`Монитор «${name}» удалён`);
    emit('close');
  } catch (e) {
    toast.show(e.message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <aside class="panel" aria-label="Пульт">
    <div class="head">
      <div class="head-text">
        <h2>{{ monitor.name }}</h2>
        <div class="head-meta">
          <span class="status" :style="{ color: st.color }">{{ st.label }}</span>
          <span class="mono muted">{{ monitor.ip }}:{{ monitor.port }}</span>
        </div>
      </div>
      <button class="btn btn-icon btn-plain" type="button" aria-label="Закрыть пульт" @click="emit('close')">
        <Icon name="close" />
      </button>
    </div>

    <div v-if="monitor.status === 'unauthorized'" class="notice">
      На экране ТВ появился запрос на отладку по сети. Нажмите «Разрешить», лучше с отметкой «Всегда разрешать с этого компьютера».
      <button class="btn" type="button" :disabled="busy" @click="refresh"><Icon name="refresh" :size="16" />Проверить снова</button>
    </div>
    <div v-else-if="monitor.status === 'offline' || monitor.status === 'unknown'" class="notice">
      ТВ не отвечает. Он должен быть в режиме ожидания (не полностью выключен из розетки) и в той же сети.
      <button class="btn btn-primary" type="button" :disabled="busy" @click="refresh">Переподключить</button>
    </div>

    <button class="btn power" type="button" :disabled="!canPower || busy" @click="power">
      <Icon name="power" />{{ powerLabel }}
    </button>

    <section class="block">
      <h3>Навигация</h3>
      <div class="dpad">
        <span></span>
        <button class="btn btn-soft pad" type="button" aria-label="Вверх" :disabled="!canControl" @click="key('up')"><Icon name="up" :size="20" /></button>
        <span></span>
        <button class="btn btn-soft pad" type="button" aria-label="Влево" :disabled="!canControl" @click="key('left')"><Icon name="left" :size="20" /></button>
        <button class="btn btn-primary pad ok" type="button" :disabled="!canControl" @click="key('ok')">OK</button>
        <button class="btn btn-soft pad" type="button" aria-label="Вправо" :disabled="!canControl" @click="key('right')"><Icon name="right" :size="20" /></button>
        <span></span>
        <button class="btn btn-soft pad" type="button" aria-label="Вниз" :disabled="!canControl" @click="key('down')"><Icon name="down" :size="20" /></button>
        <span></span>
      </div>
      <div class="pair">
        <button class="btn btn-soft" type="button" :disabled="!canControl" @click="key('home')"><Icon name="home" :size="16" />Домой</button>
        <button class="btn btn-soft" type="button" :disabled="!canControl" @click="key('back')"><Icon name="back" :size="16" />Назад</button>
      </div>
    </section>

    <section class="block">
      <h3>Громкость</h3>
      <div class="pair">
        <button class="btn btn-soft" type="button" aria-label="Тише" :disabled="!canControl" @click="key('vol_down')">−</button>
        <button class="btn btn-soft" type="button" aria-label="Громче" :disabled="!canControl" @click="key('vol_up')">+</button>
        <button class="btn btn-soft" type="button" :disabled="!canControl" @click="key('mute')">Без звука</button>
      </div>
    </section>

    <section class="block">
      <h3>Источник сигнала</h3>
      <div class="inputs">
        <button v-for="i in INPUTS" :key="i.key" class="btn btn-soft" type="button" :disabled="!canControl" @click="key(i.key)">
          {{ i.label }}
        </button>
      </div>
    </section>

    <section class="block">
      <h3>Приложения и ссылки</h3>
      <button class="btn btn-soft" type="button" :disabled="!canControl || busy" @click="launch('com.google.android.youtube.tv')">YouTube</button>
      <form class="inline" @submit.prevent="launch(pkg)">
        <label for="r-pkg" class="sr-only">Пакет приложения</label>
        <input id="r-pkg" v-model="pkg" class="input mono small" placeholder="com.example.player" :disabled="!canControl">
        <button class="btn" type="submit" :disabled="!canControl || busy || !pkg.trim()">Запустить</button>
      </form>
      <form class="inline" @submit.prevent="openUrl">
        <label for="r-url" class="sr-only">Адрес страницы</label>
        <input id="r-url" v-model="url" class="input small" type="url" placeholder="https://" :disabled="!canControl">
        <button class="btn" type="submit" :disabled="!canControl || busy || !url.trim()">Открыть</button>
      </form>
    </section>

    <section class="block">
      <h3>Открывать при включении</h3>
      <form class="inline" @submit.prevent="saveStartup(startupDraft)">
        <label for="r-startup" class="sr-only">Стартовая ссылка</label>
        <input id="r-startup" v-model="startupDraft" class="input small" type="url" placeholder="https://">
        <button class="btn" type="submit" :disabled="busy || startupDraft.trim() === (monitor.startup_url || '')">Сохранить</button>
      </form>
      <button v-if="monitor.startup_url" class="btn btn-soft" type="button" :disabled="busy" @click="saveStartup('')">Убрать</button>
      <p class="muted hint">Сайт откроется каждый раз, когда экран включается.</p>
    </section>

    <section v-if="auth.isAdmin" class="block admin">
      <h3>Администрирование</h3>
      <button v-if="!confirmDelete" class="btn btn-danger" type="button" @click="confirmDelete = true">Удалить монитор</button>
      <div v-else class="pair">
        <button class="btn" type="button" @click="confirmDelete = false">Отмена</button>
        <button class="btn btn-danger-fill" type="button" :disabled="busy" @click="remove">Удалить «{{ monitor.name }}»</button>
      </div>
    </section>
    <p v-else class="muted note">Удаление мониторов доступно только администратору.</p>
  </aside>
</template>

<style scoped>
.panel {
  width: 384px; flex-shrink: 0; height: 100vh; overflow: auto; position: sticky; top: 0;
  display: flex; flex-direction: column; gap: 22px; padding: 24px;
  background: var(--panel); border-left: 1px solid var(--line-soft);
}
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.head-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.head-text h2 { font-family: var(--font-display); font-size: 20px; overflow-wrap: anywhere; }
.head-meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px; }
.notice {
  display: flex; flex-direction: column; gap: 10px; padding: 14px; font-size: 14px; color: var(--text-2);
  background: #1f2124; border: 1px solid var(--line-strong); border-radius: 10px;
}
.power { min-height: 52px; background: var(--surface-2); font-size: 15px; font-weight: 600; }
.block { display: flex; flex-direction: column; gap: 10px; }
.block h3 { margin: 0; font-size: 13px; font-weight: 500; color: var(--muted); }
.dpad { display: grid; grid-template-columns: repeat(3, 64px); gap: 8px; align-self: center; }
.pad { height: 64px; padding: 0; border-radius: 12px; }
.ok { border-radius: 50%; }
.pair { display: flex; gap: 8px; }
.pair .btn { flex: 1; }
.inputs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.inputs .btn { padding: 0 6px; }
.inline { display: flex; gap: 8px; }
.inline .input { flex: 1; min-width: 0; }
.small { font-size: 14px; }
.hint { margin: 0; font-size: 13px; }
.admin { padding-top: 16px; border-top: 1px solid var(--line-soft); }
.note { margin: 0; padding-top: 16px; border-top: 1px solid var(--line-soft); font-size: 13px; }

@media (max-width: 1100px) {
  .panel {
    position: fixed; right: 0; top: 0; z-index: 30; max-width: 100%;
    box-shadow: -24px 0 48px rgba(0, 0, 0, 0.45);
  }
}
</style>
