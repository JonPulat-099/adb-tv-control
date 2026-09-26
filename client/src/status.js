export const STATUS = {
  online: { label: 'В сети', color: 'var(--st-online)', screen: 'Экран включён' },
  standby: { label: 'Ожидание', color: 'var(--st-standby)', screen: 'Режим ожидания' },
  offline: { label: 'Нет связи', color: 'var(--st-offline)', screen: 'ТВ не отвечает' },
  unauthorized: { label: 'Подтвердите на ТВ', color: 'var(--st-auth)', screen: 'Нужно разрешение' },
  unknown: { label: 'Проверка…', color: 'var(--st-offline)', screen: 'Проверка связи…' },
};

export const statusOf = (s) => STATUS[s] || STATUS.unknown;

// SQLite CURRENT_TIMESTAMP is UTC without a zone: "2026-09-26 10:15:00"
export function formatTime(value, withDate = false) {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return d.toLocaleString('ru-RU', withDate
    ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }
    : { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const IP_RE = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
