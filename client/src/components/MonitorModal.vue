<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useMonitors } from '../stores/monitors';
import { useToast } from '../stores/toast';
import { IP_RE } from '../status';
import Icon from './Icon.vue';

const props = defineProps({ monitor: { type: Object, default: null } });
const emit = defineEmits(['close']);
const monitors = useMonitors();
const toast = useToast();

// With `monitor` set the dialog edits it instead of adding a new one
const editing = computed(() => !!props.monitor);
const form = reactive({
  name: props.monitor?.name ?? '',
  ip: props.monitor?.ip ?? '',
  port: props.monitor?.port ?? 5555,
  location: props.monitor?.location ?? '',
});
const error = ref('');
const testResult = ref('');
const busy = ref(false);
const firstInput = ref(null);

onMounted(() => firstInput.value?.focus());

const TEST_TEXT = {
  online: { ok: true, text: 'ТВ отвечает и включён' },
  standby: { ok: true, text: 'ТВ отвечает, сейчас в режиме ожидания' },
  unauthorized: { ok: false, text: 'ТВ ответил, но ждёт разрешения. Нажмите «Разрешить» на экране ТВ и проверьте снова' },
  offline: { ok: false, text: 'Нет ответа. Проверьте IP и что отладка по сети включена' },
};
const test = computed(() => TEST_TEXT[testResult.value]);

function validate() {
  if (!form.name.trim()) return 'Укажите название монитора';
  if (!IP_RE.test(form.ip.trim())) return 'Неверный IP-адрес, пример: 192.168.1.60';
  const p = Number(form.port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) return 'Порт должен быть числом от 1 до 65535';
  return '';
}

function onEdit() {
  error.value = '';
  testResult.value = '';
}

async function runTest() {
  error.value = validate();
  if (error.value) return;
  busy.value = true;
  try {
    testResult.value = (await monitors.test(form.ip.trim(), Number(form.port))).status;
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function submit() {
  error.value = validate();
  if (error.value) return;
  busy.value = true;
  try {
    const data = {
      name: form.name.trim(), ip: form.ip.trim(), port: Number(form.port), location: form.location.trim(),
    };
    if (editing.value) {
      const m = await monitors.update(props.monitor.id, data);
      toast.show(`Монитор «${m.name}» сохранён`);
    } else {
      const m = await monitors.add(data);
      toast.show(`Монитор «${m.name}» добавлен`);
    }
    emit('close');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="add-title" @submit.prevent="submit" @input="onEdit">
      <div class="head">
        <h2 id="add-title">{{ editing ? 'Изменить монитор' : 'Новый монитор' }}</h2>
        <button class="btn btn-icon btn-plain" type="button" aria-label="Закрыть" @click="emit('close')"><Icon name="close" /></button>
      </div>
      <ol v-if="!editing" class="steps">
        <li>На ТВ: Настройки → Об устройстве → 7 раз нажмите «Сборка».</li>
        <li>В разделе «Для разработчиков» включите отладку по сети.</li>
        <li>Узнайте IP в настройках сети и введите его ниже.</li>
        <li>При первом подключении разрешите отладку на экране ТВ.</li>
      </ol>
      <div class="field">
        <label for="m-name">Название</label>
        <input id="m-name" ref="firstInput" v-model="form.name" class="input" placeholder="Например, Ресепшн" maxlength="80">
      </div>
      <div class="two">
        <div class="field grow">
          <label for="m-ip">IP-адрес</label>
          <input id="m-ip" v-model="form.ip" class="input mono" placeholder="192.168.1.60" inputmode="decimal">
        </div>
        <div class="field port">
          <label for="m-port">Порт</label>
          <input id="m-port" v-model="form.port" class="input mono" inputmode="numeric">
        </div>
      </div>
      <div class="field">
        <label for="m-loc">Расположение</label>
        <input id="m-loc" v-model="form.location" class="input" placeholder="Например, 2 этаж" maxlength="120">
      </div>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <p v-else-if="test" :class="test.ok ? 'ok-text' : 'error-text'" role="status">{{ test.text }}</p>
      <div class="foot">
        <button class="btn btn-plain" type="button" @click="emit('close')">Отмена</button>
        <button class="btn" type="button" :disabled="busy" @click="runTest">
          {{ busy ? 'Проверка…' : 'Проверить подключение' }}
        </button>
        <button class="btn btn-primary" type="submit" :disabled="busy">{{ editing ? 'Сохранить' : 'Добавить' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 40; padding: 16px; overflow: auto;
  background: rgba(8, 9, 10, 0.74); display: flex; align-items: center; justify-content: center;
}
.dialog {
  width: 100%; max-width: 540px; padding: 32px; display: flex; flex-direction: column; gap: 18px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
}
.head { display: flex; align-items: center; justify-content: space-between; }
.head h2 { font-family: var(--font-display); font-size: 22px; }
.steps {
  margin: 0; padding: 14px 16px 14px 34px; font-size: 13px; line-height: 1.6; color: var(--text-2);
  background: var(--panel); border: 1px solid var(--line-soft); border-radius: 10px;
}
.two { display: flex; gap: 12px; }
.grow { flex: 1; }
.port { width: 120px; }
.error-text, .ok-text { margin: 0; font-size: 14px; }
.ok-text { color: var(--st-online); }
.foot { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; padding-top: 4px; }
@media (max-width: 520px) { .dialog { padding: 24px 18px; } }
</style>
